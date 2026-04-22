"""
Fonctions utilitaires liees a l'authentification.

Ce module centralise :
- le hachage des mots de passe (PBKDF2-SHA256 via passlib)
- la verification des mots de passe
- la creation des jetons JWT signes avec HMAC-SHA256
- la lecture et la validation des jetons JWT
- la gestion d'une liste noire de jetons revoqués (logout, invalidation)

Securite :
- PBKDF2-SHA256 est resistant aux attaques par force brute (derive de cle lente)
- JWT HS256 garantit l'integrite du token sans stocker de session cote serveur
- L'algorithme est fixe a HS256 — jamais surchargeable par env var (previent algorithm confusion)
- La cle secrete doit etre longue et aleatoire en production (variable SECRET_KEY)
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import jwt
from jwt.exceptions import InvalidTokenError as JWTError
from passlib.context import CryptContext

# Contexte de hachage : PBKDF2-SHA256 avec sel aleatoire automatique.
# "deprecated=auto" permet une migration transparente vers de nouveaux algorithmes.
contexte_mots_de_passe = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Cle secrete lue depuis l'environnement. Ne jamais coder cette valeur en dur.
# L'application refuse de demarrer si SECRET_KEY est absente ou vide.
CLE_SECRETE = os.getenv("SECRET_KEY")
if not CLE_SECRETE:
    raise RuntimeError(
        "La variable d'environnement SECRET_KEY est manquante ou vide. "
        "Generez une cle : python -c \"import secrets; print(secrets.token_hex(32))\""
    )

# Algorithme de signature fixe — NE PAS rendre configurable par env var.
# Une variable d'env permettrait une attaque "algorithm confusion" (algo=none).
ALGORITHME_JWT = "HS256"

# Duree de vie du token en minutes avant expiration automatique (defaut : 7 jours).
DUREE_EXPIRATION_JETON_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

# ─────────────────────────────────────────────────────────────────────────────
# LISTE NOIRE DES JETONS REVOQUES
# ─────────────────────────────────────────────────────────────────────────────
# Stockage en memoire : suffisant pour un projet academique.
# En production, utiliser Redis avec TTL = duree d'expiration du token.
# Format : { jti_ou_token_hash : datetime_expiration }
_jetons_revoques: Dict[str, datetime] = {}


def revoquer_jeton(jeton: str) -> None:
    """
    Ajoute un jeton a la liste noire (MongoDB si disponible, sinon memoire).
    Le jeton sera refuse par verifier_jeton meme s'il est encore dans sa periode de validite.
    """
    import hashlib
    token_hash = hashlib.sha256(jeton.encode()).hexdigest()
    contenu = decoder_jeton(jeton)
    if contenu and "exp" in contenu:
        expiration = datetime.fromtimestamp(contenu["exp"], tz=timezone.utc)
    else:
        expiration = datetime.now(timezone.utc) + timedelta(hours=24)

    try:
        from app.database import obtenir_collection_jetons_revoques
        col = obtenir_collection_jetons_revoques()
        if col is not None:
            col.replace_one(
                {"_id": token_hash},
                {"_id": token_hash, "expires_at": expiration},
                upsert=True,
            )
            return
    except Exception:
        pass

    # Fallback in-memory
    _jetons_revoques[token_hash] = expiration
    _nettoyer_jetons_expires()


def _est_jeton_revoquer(jeton: str) -> bool:
    """Verifie si le jeton figure dans la liste noire (MongoDB ou memoire)."""
    import hashlib
    token_hash = hashlib.sha256(jeton.encode()).hexdigest()

    try:
        from app.database import obtenir_collection_jetons_revoques
        col = obtenir_collection_jetons_revoques()
        if col is not None:
            return col.find_one({"_id": token_hash}) is not None
    except Exception:
        pass

    return token_hash in _jetons_revoques


def _nettoyer_jetons_expires() -> None:
    """Supprime les entrees expirees de la liste noire en memoire."""
    maintenant = datetime.now(timezone.utc)
    expires = [h for h, exp in _jetons_revoques.items() if exp <= maintenant]
    for h in expires:
        del _jetons_revoques[h]


def verifier_mot_de_passe(mot_de_passe_en_clair: str, mot_de_passe_hache: str) -> bool:
    """
    Compare un mot de passe en clair avec son hash stocke en base.

    passlib rehache automatiquement si l'algorithme a change depuis la creation.
    Retourne True si le mot de passe correspond, False sinon.
    """
    return contexte_mots_de_passe.verify(mot_de_passe_en_clair, mot_de_passe_hache)


def generer_hash_mot_de_passe(mot_de_passe: str) -> str:
    """
    Genere un hash securise a partir du mot de passe fourni.

    Le sel est genere aleatoirement par passlib a chaque appel.
    Le resultat inclut l'algorithme, les parametres et le sel — tout en un seul champ.
    """
    return contexte_mots_de_passe.hash(mot_de_passe)


def creer_jeton_acces(
    donnees: Dict,
    duree_expiration: Optional[timedelta] = None,
) -> str:
    """
    Cree un jeton JWT signe avec la cle secrete du serveur.

    Le contenu du jeton inclut :
    - les donnees de l'utilisateur (sub = identifiant, email, ...)
    - exp : date d'expiration (Unix timestamp)
    - iat : date d'emission (issued at)

    Le jeton est signe mais pas chiffre — ne pas y stocker de donnees sensibles.
    """
    contenu_a_encoder = donnees.copy()

    maintenant = datetime.now(timezone.utc)
    expiration = maintenant + (
        duree_expiration or timedelta(minutes=DUREE_EXPIRATION_JETON_MINUTES)
    )

    # Ajout des claims standards JWT (exp et iat)
    contenu_a_encoder.update({"exp": expiration, "iat": maintenant})

    # Encodage et signature du token avec PyJWT — algorithme fixe HS256
    return jwt.encode(contenu_a_encoder, CLE_SECRETE, algorithm=ALGORITHME_JWT)


def decoder_jeton(jeton: str) -> Optional[Dict]:
    """
    Decode un jeton JWT et retourne son contenu si valide.

    PyJWT verifie automatiquement :
    - la signature (integrite)
    - la date d'expiration (exp)
    - l'algorithme : seul HS256 est accepte (previent algorithm confusion)
    Retourne None si le token est invalide ou expire.
    """
    try:
        # algorithms=[ALGORITHME_JWT] est obligatoire : empeche de changer d'algo via le header JWT
        return jwt.decode(jeton, CLE_SECRETE, algorithms=[ALGORITHME_JWT])
    except JWTError:
        return None


def verifier_jeton(jeton: str) -> Optional[str]:
    """
    Valide un jeton JWT et retourne l'identifiant utilisateur (champ 'sub').

    Verifie egalement que le token n'a pas ete revoquer (liste noire).
    Retourne None si le token est invalide, expire, revoquer ou sans 'sub'.
    Utilise par toutes les routes protegees via Depends(obtenir_utilisateur_courant).
    """
    if _est_jeton_revoquer(jeton):
        return None
    contenu = decoder_jeton(jeton)
    if contenu:
        return contenu.get("sub")
    return None
