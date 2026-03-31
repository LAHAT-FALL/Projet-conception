"""
Routes REST d'authentification pour QuoteKeeper.

Ce module expose les endpoints suivants :
- POST /register : creation d'un nouveau compte utilisateur
- POST /login    : connexion d'un utilisateur existant
- POST /logout   : deconnexion (confirmation symbolique)

La deconnexion est geree cote client (suppression du token JWT du localStorage).
Le serveur ne maintient pas de session — l'architecture est stateless.
"""

import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError

from app.auth import creer_jeton_acces, generer_hash_mot_de_passe, verifier_jeton, verifier_mot_de_passe
from app.database import obtenir_collection_utilisateurs
from app.demo_store import get_demo_user_by_email, update_demo_user_profile, upsert_demo_user

router = APIRouter()

# Expression reguliere pour valider le format d'une adresse email
REGEX_COURRIEL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class DonneesCreationUtilisateur(BaseModel):
    """
    Donnees attendues dans le corps de la requete POST /register.

    Contraintes :
    - nom          : 2 a 50 caracteres, espaces superflus supprimes
    - email        : format valide, converti en minuscules
    - mot_de_passe : 6 a 72 caracteres (72 est la limite de PBKDF2-SHA256)
    """
    nom: str = Field(..., min_length=2, max_length=50)
    email: str
    mot_de_passe: str = Field(..., min_length=6, max_length=72)

    model_config = {
        "json_schema_extra": {
            "example": {
                "nom": "Dupont",
                "email": "jean.dupont@email.com",
                "mot_de_passe": "password123",
            }
        }
    }

    @field_validator("nom")
    @classmethod
    def valider_nom(cls, valeur: str) -> str:
        """Supprime les espaces superflus et verifie la longueur minimale."""
        nom = valeur.strip()
        if len(nom) < 2:
            raise ValueError("Le nom doit contenir au moins 2 caracteres")
        return nom

    @field_validator("email")
    @classmethod
    def valider_courriel(cls, valeur: str) -> str:
        """Normalise l'email en minuscules et verifie le format."""
        email = valeur.strip().lower()
        if not REGEX_COURRIEL.match(email):
            raise ValueError("Adresse email invalide")
        return email


class DonneesConnexionUtilisateur(BaseModel):
    """
    Donnees attendues dans le corps de la requete POST /login.

    Contraintes :
    - email        : format valide, converti en minuscules
    - mot_de_passe : entre 1 et 72 caracteres
    """
    email: str
    mot_de_passe: str = Field(..., min_length=1, max_length=72)

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "jean.dupont@email.com",
                "mot_de_passe": "password123",
            }
        }
    }

    @field_validator("email")
    @classmethod
    def valider_courriel(cls, valeur: str) -> str:
        """Normalise l'email en minuscules et verifie le format."""
        email = valeur.strip().lower()
        if not REGEX_COURRIEL.match(email):
            raise ValueError("Adresse email invalide")
        return email


class ReponseUtilisateur(BaseModel):
    """
    Informations utilisateur renvoyees au frontend apres connexion ou inscription.

    Ne contient jamais le mot de passe ou son hash.
    """
    id: str
    nom: str
    email: str
    favorites: list[str] = Field(default_factory=list)
    cree_le: Optional[str] = None


class ReponseJeton(BaseModel):
    """
    Structure renvoyee apres une inscription ou une connexion reussie.

    - access_token : JWT a stocker dans localStorage cote client
    - token_type   : toujours "bearer" (standard OAuth2)
    - user         : informations publiques de l'utilisateur
    """
    access_token: str
    token_type: str = "bearer"
    user: ReponseUtilisateur


def construire_reponse_utilisateur(utilisateur: dict) -> ReponseUtilisateur:
    """
    Convertit un document MongoDB (ou demo) en objet ReponseUtilisateur.

    Gere les deux cas possibles pour l'identifiant :
    - document MongoDB : champ "_id" (ObjectId converti en str)
    - document demo    : champ "id" (str directement)
    """
    date_creation = utilisateur.get("cree_le")
    return ReponseUtilisateur(
        id=str(utilisateur["id"] if "id" in utilisateur else utilisateur["_id"]),
        nom=utilisateur["nom"],
        email=utilisateur["email"],
        favorites=utilisateur.get("favorites", []),
        # Conversion de datetime en chaine ISO si necessaire
        cree_le=date_creation.isoformat() if hasattr(date_creation, "isoformat") else date_creation,
    )


@router.post(
    "/register",
    response_model=ReponseJeton,
    status_code=status.HTTP_201_CREATED,
    summary="Inscription d'un nouvel utilisateur",
)
async def inscription(utilisateur: DonneesCreationUtilisateur):
    """
    Cree un nouveau compte utilisateur et retourne un token JWT.

    En mode demo (MongoDB indisponible), le compte est cree en memoire.
    En mode normal, le mot de passe est hache avant stockage.
    Retourne HTTP 400 si l'email est deja utilise.
    """
    collection_utilisateurs = obtenir_collection_utilisateurs()

    # Mode demo : MongoDB indisponible
    if collection_utilisateurs is None:
        # Genereration d'un ID demo base sur l'email
        identifiant_demo = f"demo_{re.sub(r'[^a-z0-9]', '_', utilisateur.email)}"
        utilisateur_demo = upsert_demo_user(identifiant_demo, utilisateur.nom, utilisateur.email)
        return ReponseJeton(
            access_token=creer_jeton_acces(
                {"sub": utilisateur_demo["id"], "email": utilisateur_demo["email"]}
            ),
            user=construire_reponse_utilisateur(utilisateur_demo),
        )

    maintenant = datetime.now(timezone.utc)

    # Construction du document a inserer dans MongoDB
    document_utilisateur = {
        "nom": utilisateur.nom,
        "email": utilisateur.email,
        # Hachage du mot de passe — jamais stocker en clair
        "mot_de_passe_hash": generer_hash_mot_de_passe(utilisateur.mot_de_passe),
        "favorites": [],           # Liste vide au depart
        "favorite_quotes": {},     # Dictionnaire vide au depart
        "cree_le": maintenant,
        "modifie_le": maintenant,
    }

    try:
        resultat = collection_utilisateurs.insert_one(document_utilisateur)
    except DuplicateKeyError:
        # L'index unique sur email empeche les doublons
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte avec cet email existe deja",
        )

    # Relecture du document insere pour avoir l'_id genere par MongoDB
    utilisateur_cree = collection_utilisateurs.find_one({"_id": resultat.inserted_id})
    jeton_acces = creer_jeton_acces(
        {"sub": str(utilisateur_cree["_id"]), "email": utilisateur_cree["email"]}
    )
    return ReponseJeton(
        access_token=jeton_acces,
        user=construire_reponse_utilisateur(utilisateur_cree),
    )


@router.post(
    "/login",
    response_model=ReponseJeton,
    summary="Connexion d'un utilisateur",
)
async def connexion(utilisateur: DonneesConnexionUtilisateur):
    """
    Authentifie un utilisateur existant et retourne un token JWT.

    Verification en deux etapes :
    1. L'email existe-t-il en base ?
    2. Le mot de passe correspond-il au hash stocke ?

    Le message d'erreur est identique dans les deux cas pour ne pas
    indiquer si l'email existe ou non (securite contre l'enumeration).
    """
    collection_utilisateurs = obtenir_collection_utilisateurs()

    # Mode demo : seul le compte demo est accepte
    if collection_utilisateurs is None:
        if utilisateur.email == "demo@test.com" and utilisateur.mot_de_passe == "demo123":
            utilisateur_demo = get_demo_user_by_email(utilisateur.email)
            if utilisateur_demo is None:
                # Creation du compte demo s'il n'existe pas encore
                utilisateur_demo = upsert_demo_user("demo_123", "Utilisateur Demo", "demo@test.com")

            return ReponseJeton(
                access_token=creer_jeton_acces(
                    {"sub": utilisateur_demo["id"], "email": utilisateur_demo["email"]}
                ),
                user=construire_reponse_utilisateur(utilisateur_demo),
            )

        # Tout autre compte en mode demo est refuse
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    # Recherche de l'utilisateur par email
    utilisateur_trouve = collection_utilisateurs.find_one({"email": utilisateur.email})

    # Verification de l'email ET du mot de passe dans la meme condition
    # pour eviter de distinguer "email inconnu" de "mot de passe incorrect"
    if not utilisateur_trouve or not verifier_mot_de_passe(
        utilisateur.mot_de_passe,
        utilisateur_trouve["mot_de_passe_hash"],
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    # Generation du token JWT pour la session
    jeton_acces = creer_jeton_acces(
        {"sub": str(utilisateur_trouve["_id"]), "email": utilisateur_trouve["email"]}
    )
    return ReponseJeton(
        access_token=jeton_acces,
        user=construire_reponse_utilisateur(utilisateur_trouve),
    )


@router.post("/logout", summary="Deconnexion")
async def deconnexion():
    """
    Confirme la deconnexion de l'utilisateur.

    Le token JWT est stateless : la vraie deconnexion est geree cote client
    en supprimant le token du localStorage. Cet endpoint retourne simplement
    une confirmation pour que le frontend sache que la requete a abouti.
    """
    return {"status": "success", "message": "Deconnexion reussie"}


# ─────────────────────────────────────────────────────────────────────────────
# DEPENDANCE JWT POUR LES ROUTES DE PROFIL
# ─────────────────────────────────────────────────────────────────────────────

async def obtenir_utilisateur_courant_auth(authorization: Optional[str] = Header(None)):
    """
    Dependance FastAPI pour les routes de profil.
    Extrait et valide le token JWT du header Authorization.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token d'authentification manquant",
        )
    morceaux = authorization.split()
    if len(morceaux) != 2 or morceaux[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Format de token invalide",
        )
    identifiant = verifier_jeton(morceaux[1])
    if not identifiant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expire",
        )
    return identifiant


# ─────────────────────────────────────────────────────────────────────────────
# MODELES DE DONNEES POUR LE PROFIL
# ─────────────────────────────────────────────────────────────────────────────

class DonneesModificationProfil(BaseModel):
    """Corps de la requete PUT /profile pour modifier le nom."""
    nom: str = Field(..., min_length=2, max_length=50)

    @field_validator("nom")
    @classmethod
    def valider_nom(cls, valeur: str) -> str:
        nom = valeur.strip()
        if len(nom) < 2:
            raise ValueError("Le nom doit contenir au moins 2 caracteres")
        return nom


class DonneesChangementMotDePasse(BaseModel):
    """Corps de la requete PUT /profile/password pour changer le mot de passe."""
    mot_de_passe_actuel: str = Field(..., min_length=1, max_length=72)
    nouveau_mot_de_passe: str = Field(..., min_length=6, max_length=72)


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS DE PROFIL
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/profile", summary="Obtenir le profil de l'utilisateur connecte")
async def obtenir_profil(utilisateur_id: str = Depends(obtenir_utilisateur_courant_auth)):
    """
    Retourne les informations publiques du compte de l'utilisateur connecte.
    Ne retourne jamais le hash du mot de passe.
    """
    collection_utilisateurs = obtenir_collection_utilisateurs()

    # Mode demo
    if collection_utilisateurs is None:
        from app.demo_store import get_demo_user_by_id
        utilisateur = get_demo_user_by_id(utilisateur_id)
        if not utilisateur:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouve")
        return {
            "id": utilisateur["id"],
            "nom": utilisateur["nom"],
            "email": utilisateur["email"],
            "a_mot_de_passe": False,
        }

    try:
        utilisateur = collection_utilisateurs.find_one({"_id": ObjectId(utilisateur_id)})
        if not utilisateur:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouve")

        return {
            "id": str(utilisateur["_id"]),
            "nom": utilisateur["nom"],
            "email": utilisateur["email"],
            # Indique si le compte a un mot de passe (False pour les comptes Google purs)
            "a_mot_de_passe": utilisateur.get("mot_de_passe_hash") is not None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.put("/profile", summary="Modifier le nom d'affichage")
async def modifier_profil(
    donnees: DonneesModificationProfil,
    utilisateur_id: str = Depends(obtenir_utilisateur_courant_auth),
):
    """
    Modifie le nom d'affichage de l'utilisateur connecte.
    Met a jour le localStorage cote client apres succes.
    """
    collection_utilisateurs = obtenir_collection_utilisateurs()

    if collection_utilisateurs is None:
        resultat = update_demo_user_profile(utilisateur_id, donnees.nom)
        if not resultat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouve")
        return {"status": "success", "message": "Nom mis a jour", "nom": donnees.nom}

    try:
        resultat = collection_utilisateurs.update_one(
            {"_id": ObjectId(utilisateur_id)},
            {"$set": {"nom": donnees.nom, "modifie_le": datetime.now(timezone.utc)}},
        )
        if resultat.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouve")
        return {"status": "success", "message": "Nom mis a jour", "nom": donnees.nom}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.put("/profile/password", summary="Changer le mot de passe")
async def changer_mot_de_passe(
    donnees: DonneesChangementMotDePasse,
    utilisateur_id: str = Depends(obtenir_utilisateur_courant_auth),
):
    """
    Change le mot de passe de l'utilisateur connecte.

    Etapes :
    1. Verification que le mot de passe actuel est correct
    2. Hachage du nouveau mot de passe
    3. Mise a jour en base de donnees

    Les comptes Google (sans mot de passe) ne peuvent pas utiliser cet endpoint.
    """
    collection_utilisateurs = obtenir_collection_utilisateurs()

    if collection_utilisateurs is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Changement de mot de passe non disponible en mode demo",
        )

    try:
        utilisateur = collection_utilisateurs.find_one({"_id": ObjectId(utilisateur_id)})
        if not utilisateur:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouve")

        # Verification que le compte a un mot de passe (pas un compte Google pur)
        if not utilisateur.get("mot_de_passe_hash"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce compte utilise la connexion Google et n'a pas de mot de passe",
            )

        # Verification du mot de passe actuel avant de permettre le changement
        if not verifier_mot_de_passe(donnees.mot_de_passe_actuel, utilisateur["mot_de_passe_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Mot de passe actuel incorrect",
            )

        # Hachage et sauvegarde du nouveau mot de passe
        nouveau_hash = generer_hash_mot_de_passe(donnees.nouveau_mot_de_passe)
        collection_utilisateurs.update_one(
            {"_id": ObjectId(utilisateur_id)},
            {"$set": {"mot_de_passe_hash": nouveau_hash, "modifie_le": datetime.now(timezone.utc)}},
        )

        return {"status": "success", "message": "Mot de passe modifie avec succes"}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
