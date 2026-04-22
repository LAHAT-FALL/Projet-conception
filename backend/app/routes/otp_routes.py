"""
Authentification par code OTP envoyé par courriel.

Endpoints :
- POST /otp/request : génère un code à 6 chiffres et l'envoie par email
- POST /otp/verify  : vérifie le code et retourne un JWT

Sécurité :
- Code haché (SHA-256) avant stockage — jamais en clair en mémoire
- Expiration après 10 minutes
- Maximum 5 tentatives par code
- Anti-spam : 60 secondes entre deux demandes pour le même email
"""

import hashlib
import os
import secrets
import smtplib
import string
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

from app.auth import creer_jeton_acces
from app.database import (
    obtenir_collection_utilisateurs,
    obtenir_collection_otp_codes,
    obtenir_collection_reset_codes,
)
from app.demo_store import get_demo_user_by_email, upsert_demo_user

router = APIRouter()

# ─── Configuration SMTP ───────────────────────────────────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# ─── Stockage OTP en mémoire ──────────────────────────────────────────────────
# { email: { "code_hash": str, "expires_at": datetime, "attempts": int, "requested_at": datetime } }
_otp_store: dict = {}

# ─── Stockage des codes de réinitialisation de mot de passe ───────────────────
_reset_store: dict = {}

DUREE_EXPIRATION_MINUTES = 10
DELAI_ANTI_SPAM_SECONDES = 60
MAX_TENTATIVES = 5


# ─── Modèles ──────────────────────────────────────────────────────────────────

class DemandeOtp(BaseModel):
    email: str = Field(..., min_length=5, max_length=100)

    @field_validator("email")
    @classmethod
    def normaliser_email(cls, v: str) -> str:
        email = v.strip().lower()
        if "@" not in email or "." not in email:
            raise ValueError("Adresse email invalide")
        return email


class VerificationOtp(BaseModel):
    email: str = Field(..., min_length=5, max_length=100)
    code: str = Field(..., min_length=6, max_length=6)

    @field_validator("email")
    @classmethod
    def normaliser_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("code")
    @classmethod
    def valider_code(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("Le code doit contenir uniquement des chiffres")
        return v


# ─── Fonctions utilitaires ────────────────────────────────────────────────────

def _hacher_code(code: str) -> str:
    """Retourne le hash SHA-256 du code OTP."""
    return hashlib.sha256(code.encode()).hexdigest()


def _aware(dt: datetime) -> datetime:
    """Rend un datetime timezone-aware (UTC) si ce n'est pas déjà le cas.
    MongoDB retourne des datetimes naïfs (UTC implicite) — cette fonction
    normalise avant toute comparaison avec datetime.now(timezone.utc).
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _generer_code() -> str:
    """Génère un code OTP à 6 chiffres cryptographiquement aleatoire."""
    return "".join(secrets.choice(string.digits) for _ in range(6))


def _envoyer_email(destinataire: str, code: str) -> None:
    """Envoie le code OTP par email via SMTP (appelé dans un thread)."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        # Ne jamais afficher le code complet — affiche seulement les 2 derniers chiffres
        print(f"[OTP] Mode debug — code envoye a {destinataire} (finit par ...{code[-2:]})")
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = "Votre code de connexion QuoteKeeper"
    message["From"] = SMTP_EMAIL
    message["To"] = destinataire

    corps_texte = (
        f"Votre code de connexion QuoteKeeper est : {code}\n\n"
        f"Ce code expire dans {DUREE_EXPIRATION_MINUTES} minutes.\n"
        "Si vous n'avez pas demandé ce code, ignorez ce message."
    )
    corps_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:400px;margin:auto;padding:32px;
                background:#f9f9f9;border-radius:12px;border:1px solid #e0e0e0;">
      <h2 style="color:#667eea;text-align:center;margin-bottom:8px;">QuoteKeeper</h2>
      <p style="color:#555;text-align:center;margin-bottom:24px;">
        Votre code de connexion
      </p>
      <div style="background:#667eea;border-radius:10px;padding:24px;text-align:center;">
        <span style="color:#fff;font-size:36px;font-weight:bold;letter-spacing:8px;">{code}</span>
      </div>
      <p style="color:#888;font-size:13px;text-align:center;margin-top:20px;">
        Ce code expire dans <strong>{DUREE_EXPIRATION_MINUTES} minutes</strong>.
      </p>
    </div>
    """

    message.attach(MIMEText(corps_texte, "plain"))
    message.attach(MIMEText(corps_html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as serveur:
        serveur.ehlo()
        serveur.starttls()
        serveur.login(SMTP_EMAIL, SMTP_PASSWORD)
        serveur.sendmail(SMTP_EMAIL, destinataire, message.as_string())

    print(f"[OTP] Code envoyé à {destinataire}")


def _trouver_ou_creer_utilisateur(email: str) -> dict:
    """Trouve un utilisateur par email ou crée un nouveau compte OTP."""
    collection = obtenir_collection_utilisateurs()

    if collection is None:
        utilisateur = get_demo_user_by_email(email)
        if not utilisateur:
            nom = email.split("@")[0].capitalize()
            identifiant_demo = f"demo_{email.replace('@', '_').replace('.', '_')}"
            utilisateur = upsert_demo_user(identifiant_demo, nom, email)
        return utilisateur

    utilisateur = collection.find_one({"email": email})
    if not utilisateur:
        from datetime import datetime, timezone
        maintenant = datetime.now(timezone.utc)
        nom = email.split("@")[0].capitalize()
        resultat = collection.insert_one({
            "nom": nom,
            "email": email,
            "mot_de_passe_hash": None,
            "favorites": [],
            "favorite_quotes": {},
            "cree_le": maintenant,
            "modifie_le": maintenant,
        })
        utilisateur = collection.find_one({"_id": resultat.inserted_id})

    return utilisateur


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/otp/request", summary="Demander un code OTP par email")
@limiter.limit("3/minute")
async def demander_otp(request: Request, donnees: DemandeOtp, background_tasks: BackgroundTasks):
    """
    Génère un code OTP à 6 chiffres et l'envoie à l'adresse email fournie.

    Anti-spam : une seule demande autorisée toutes les 60 secondes par email.
    Le code expire après 10 minutes.
    L'envoi SMTP se fait en arrière-plan pour retourner 200 immédiatement.
    """
    email = donnees.email
    maintenant = datetime.now(timezone.utc)
    col_otp = obtenir_collection_otp_codes()

    # Vérification anti-spam
    if col_otp is not None:
        entree_existante = col_otp.find_one({"_id": email})
    else:
        entree_existante = _otp_store.get(email)

    if entree_existante:
        delai_ecoule = (maintenant - _aware(entree_existante["requested_at"])).total_seconds()
        if delai_ecoule < DELAI_ANTI_SPAM_SECONDES:
            restant = int(DELAI_ANTI_SPAM_SECONDES - delai_ecoule)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Veuillez attendre {restant} secondes avant de demander un nouveau code.",
            )

    code = _generer_code()
    entree = {
        "code_hash": _hacher_code(code),
        "expires_at": maintenant + timedelta(minutes=DUREE_EXPIRATION_MINUTES),
        "attempts": 0,
        "requested_at": maintenant,
    }

    if col_otp is not None:
        col_otp.replace_one({"_id": email}, {"_id": email, **entree}, upsert=True)
    else:
        _otp_store[email] = entree

    # Envoi en arrière-plan : la réponse 200 part immédiatement,
    # le SMTP s'exécute après sans bloquer le client.
    background_tasks.add_task(_envoyer_email, email, code)

    return {"message": f"Code envoyé à {email}. Vérifiez votre boîte mail."}


@router.post("/otp/verify", summary="Vérifier le code OTP et obtenir un JWT")
@limiter.limit("10/minute")
async def verifier_otp(request: Request, donnees: VerificationOtp):
    """
    Vérifie le code OTP. Si correct, connecte ou crée l'utilisateur et retourne un JWT.

    - Maximum 5 tentatives avant que le code soit invalidé.
    - Le code est supprimé après une vérification réussie.
    """
    email = donnees.email
    maintenant = datetime.now(timezone.utc)
    col_otp = obtenir_collection_otp_codes()

    if col_otp is not None:
        entree = col_otp.find_one({"_id": email})
    else:
        entree = _otp_store.get(email)

    if not entree:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun code actif pour cet email. Faites une nouvelle demande.",
        )

    if maintenant > _aware(entree["expires_at"]):
        if col_otp is not None:
            col_otp.delete_one({"_id": email})
        else:
            _otp_store.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le code a expiré. Faites une nouvelle demande.",
        )

    if entree["attempts"] >= MAX_TENTATIVES:
        if col_otp is not None:
            col_otp.delete_one({"_id": email})
        else:
            _otp_store.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trop de tentatives. Faites une nouvelle demande.",
        )

    if _hacher_code(donnees.code) != entree["code_hash"]:
        if col_otp is not None:
            result = col_otp.find_one_and_update(
                {"_id": email}, {"$inc": {"attempts": 1}}, return_document=True
            )
            restantes = MAX_TENTATIVES - (result["attempts"] if result else MAX_TENTATIVES)
        else:
            _otp_store[email]["attempts"] += 1
            restantes = MAX_TENTATIVES - _otp_store[email]["attempts"]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Code incorrect. {restantes} tentative(s) restante(s).",
        )

    # Code valide : supprimer l'entrée
    if col_otp is not None:
        col_otp.delete_one({"_id": email})
    else:
        _otp_store.pop(email, None)

    utilisateur = _trouver_ou_creer_utilisateur(email)
    identifiant = str(utilisateur.get("id") or utilisateur.get("_id"))

    jeton = creer_jeton_acces({"sub": identifiant, "email": email})

    nom = utilisateur.get("nom", email.split("@")[0].capitalize())
    return {
        "access_token": jeton,
        "token_type": "bearer",
        "user": {
            "id": identifiant,
            "nom": nom,
            "email": email,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# RÉINITIALISATION DE MOT DE PASSE
# ─────────────────────────────────────────────────────────────────────────────

class DemandeResetMDP(BaseModel):
    email: str = Field(..., min_length=5, max_length=100)

    @field_validator("email")
    @classmethod
    def normaliser_email(cls, v: str) -> str:
        email = v.strip().lower()
        if "@" not in email or "." not in email:
            raise ValueError("Adresse email invalide")
        return email


class VerificationResetMDP(BaseModel):
    email: str = Field(..., min_length=5, max_length=100)
    code: str = Field(..., min_length=6, max_length=6)
    nouveau_mot_de_passe: str = Field(..., min_length=12, max_length=72)

    @field_validator("email")
    @classmethod
    def normaliser_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("code")
    @classmethod
    def valider_code(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("Le code doit contenir uniquement des chiffres")
        return v

    @field_validator("nouveau_mot_de_passe")
    @classmethod
    def valider_mot_de_passe(cls, v: str) -> str:
        if len(v) < 12:
            raise ValueError("Le mot de passe doit contenir au moins 12 caractères")
        if not any(c.isupper() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not any(c.islower() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une minuscule")
        if not any(c.isdigit() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        return v


def _envoyer_email_reset(destinataire: str, code: str) -> None:
    """Envoie le code de réinitialisation de mot de passe par email."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"[RESET] Mode debug — code envoyé à {destinataire} (finit par ...{code[-2:]})")
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = "Réinitialisation de votre mot de passe QuoteKeeper"
    message["From"] = SMTP_EMAIL
    message["To"] = destinataire

    corps_texte = (
        f"Votre code de réinitialisation QuoteKeeper est : {code}\n\n"
        f"Ce code expire dans {DUREE_EXPIRATION_MINUTES} minutes.\n"
        "Si vous n'avez pas demandé cette réinitialisation, ignorez ce message."
    )
    corps_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:400px;margin:auto;padding:32px;
                background:#f9f9f9;border-radius:12px;border:1px solid #e0e0e0;">
      <h2 style="color:#667eea;text-align:center;margin-bottom:8px;">QuoteKeeper</h2>
      <p style="color:#555;text-align:center;margin-bottom:24px;">
        Réinitialisation de mot de passe
      </p>
      <div style="background:#667eea;border-radius:10px;padding:24px;text-align:center;">
        <span style="color:#fff;font-size:36px;font-weight:bold;letter-spacing:8px;">{code}</span>
      </div>
      <p style="color:#888;font-size:13px;text-align:center;margin-top:20px;">
        Ce code expire dans <strong>{DUREE_EXPIRATION_MINUTES} minutes</strong>.<br>
        Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
      </p>
    </div>
    """

    message.attach(MIMEText(corps_texte, "plain"))
    message.attach(MIMEText(corps_html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as serveur:
        serveur.ehlo()
        serveur.starttls()
        serveur.login(SMTP_EMAIL, SMTP_PASSWORD)
        serveur.sendmail(SMTP_EMAIL, destinataire, message.as_string())

    print(f"[RESET] Code de réinitialisation envoyé à {destinataire}")


@router.post("/password-reset/request", summary="Demander un code de réinitialisation de mot de passe")
@limiter.limit("3/minute")
async def demander_reset_mdp(request: Request, donnees: DemandeResetMDP, background_tasks: BackgroundTasks):
    """
    Envoie un code de réinitialisation à l'email fourni si un compte existe.
    Retourne toujours 200 pour ne pas révéler l'existence du compte.
    L'envoi SMTP se fait en arrière-plan pour retourner 200 immédiatement.
    """
    email = donnees.email
    maintenant = datetime.now(timezone.utc)
    col_reset = obtenir_collection_reset_codes()

    # Anti-spam
    if col_reset is not None:
        entree_existante = col_reset.find_one({"_id": email})
    else:
        entree_existante = _reset_store.get(email)

    if entree_existante:
        delai_ecoule = (maintenant - _aware(entree_existante["requested_at"])).total_seconds()
        if delai_ecoule < DELAI_ANTI_SPAM_SECONDES:
            restant = int(DELAI_ANTI_SPAM_SECONDES - delai_ecoule)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Veuillez attendre {restant} secondes avant de refaire une demande.",
            )

    # Vérification discrète — on vérifie si l'utilisateur existe mais on ne le révèle pas
    collection = obtenir_collection_utilisateurs()
    utilisateur_existe = False
    if collection is not None:
        utilisateur_existe = collection.find_one({"email": email}) is not None

    code = _generer_code()
    entree = {
        "code_hash": _hacher_code(code),
        "expires_at": maintenant + timedelta(minutes=DUREE_EXPIRATION_MINUTES),
        "attempts": 0,
        "requested_at": maintenant,
    }

    if col_reset is not None:
        col_reset.replace_one({"_id": email}, {"_id": email, **entree}, upsert=True)
    else:
        _reset_store[email] = entree

    # Envoi en arrière-plan : la réponse 200 part immédiatement,
    # le SMTP s'exécute après sans bloquer le client.
    if utilisateur_existe or collection is None:
        background_tasks.add_task(_envoyer_email_reset, email, code)

    return {"message": "Si un compte existe pour cet email, un code de réinitialisation a été envoyé."}


@router.post("/password-reset/verify", summary="Vérifier le code et définir un nouveau mot de passe")
@limiter.limit("10/minute")
async def verifier_reset_mdp(request: Request, donnees: VerificationResetMDP):
    """
    Vérifie le code de réinitialisation et met à jour le mot de passe.
    """
    from app.auth import generer_hash_mot_de_passe
    from bson import ObjectId
    email = donnees.email
    maintenant = datetime.now(timezone.utc)
    col_reset = obtenir_collection_reset_codes()

    if col_reset is not None:
        entree = col_reset.find_one({"_id": email})
    else:
        entree = _reset_store.get(email)

    if not entree:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun code actif pour cet email. Faites une nouvelle demande.",
        )

    if maintenant > _aware(entree["expires_at"]):
        if col_reset is not None:
            col_reset.delete_one({"_id": email})
        else:
            _reset_store.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le code a expiré. Faites une nouvelle demande.",
        )

    if entree["attempts"] >= MAX_TENTATIVES:
        if col_reset is not None:
            col_reset.delete_one({"_id": email})
        else:
            _reset_store.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trop de tentatives. Faites une nouvelle demande.",
        )

    if _hacher_code(donnees.code) != entree["code_hash"]:
        if col_reset is not None:
            result = col_reset.find_one_and_update(
                {"_id": email}, {"$inc": {"attempts": 1}}, return_document=True
            )
            restantes = MAX_TENTATIVES - (result["attempts"] if result else MAX_TENTATIVES)
        else:
            _reset_store[email]["attempts"] += 1
            restantes = MAX_TENTATIVES - _reset_store[email]["attempts"]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Code incorrect. {restantes} tentative(s) restante(s).",
        )

    # Code valide : mise à jour du mot de passe
    collection = obtenir_collection_utilisateurs()
    if collection is None:
        if col_reset is not None:
            col_reset.delete_one({"_id": email})
        else:
            _reset_store.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Réinitialisation non disponible en mode démo.",
        )

    utilisateur = collection.find_one({"email": email})
    if not utilisateur:
        if col_reset is not None:
            col_reset.delete_one({"_id": email})
        else:
            _reset_store.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compte introuvable.",
        )

    nouveau_hash = generer_hash_mot_de_passe(donnees.nouveau_mot_de_passe)
    collection.update_one(
        {"_id": utilisateur["_id"]},
        {"$set": {"mot_de_passe_hash": nouveau_hash, "modifie_le": maintenant}},
    )

    if col_reset is not None:
        col_reset.delete_one({"_id": email})
    else:
        _reset_store.pop(email, None)
    print(f"[AUDIT] Mot de passe réinitialisé pour {email}")
    return {"message": "Mot de passe réinitialisé avec succès."}
