"""
Routes REST d'authentification pour QuoteKeeper.
"""

import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError

from app.auth import creer_jeton_acces, generer_hash_mot_de_passe, verifier_mot_de_passe
from app.database import obtenir_collection_utilisateurs
from app.demo_store import get_demo_user_by_email, upsert_demo_user

router = APIRouter()

REGEX_COURRIEL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class DonneesCreationUtilisateur(BaseModel):
    """Donnees attendues lors de la creation d'un compte."""

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
        nom = valeur.strip()
        if len(nom) < 2:
            raise ValueError("Le nom doit contenir au moins 2 caracteres")
        return nom

    @field_validator("email")
    @classmethod
    def valider_courriel(cls, valeur: str) -> str:
        email = valeur.strip().lower()
        if not REGEX_COURRIEL.match(email):
            raise ValueError("Adresse email invalide")
        return email


class DonneesConnexionUtilisateur(BaseModel):
    """Donnees attendues lors de la connexion."""

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
        email = valeur.strip().lower()
        if not REGEX_COURRIEL.match(email):
            raise ValueError("Adresse email invalide")
        return email


class ReponseUtilisateur(BaseModel):
    """Informations utilisateur renvoyees au frontend."""

    id: str
    nom: str
    email: str
    favorites: list[str] = Field(default_factory=list)
    cree_le: Optional[str] = None


class ReponseJeton(BaseModel):
    """Structure renvoyee apres une inscription ou une connexion reussie."""

    access_token: str
    token_type: str = "bearer"
    user: ReponseUtilisateur


def construire_reponse_utilisateur(utilisateur: dict) -> ReponseUtilisateur:
    """Construit une reponse uniforme a partir d'un document utilisateur."""
    date_creation = utilisateur.get("cree_le")
    return ReponseUtilisateur(
        id=str(utilisateur["id"] if "id" in utilisateur else utilisateur["_id"]),
        nom=utilisateur["nom"],
        email=utilisateur["email"],
        favorites=utilisateur.get("favorites", []),
        cree_le=date_creation.isoformat() if hasattr(date_creation, "isoformat") else date_creation,
    )


@router.post(
    "/register",
    response_model=ReponseJeton,
    status_code=status.HTTP_201_CREATED,
    summary="Inscription d'un nouvel utilisateur",
)
async def inscription(utilisateur: DonneesCreationUtilisateur):
    """Cree un nouveau compte utilisateur."""
    collection_utilisateurs = obtenir_collection_utilisateurs()

    if collection_utilisateurs is None:
        identifiant_demo = f"demo_{re.sub(r'[^a-z0-9]', '_', utilisateur.email)}"
        utilisateur_demo = upsert_demo_user(identifiant_demo, utilisateur.nom, utilisateur.email)
        return ReponseJeton(
            access_token=creer_jeton_acces(
                {"sub": utilisateur_demo["id"], "email": utilisateur_demo["email"]}
            ),
            user=construire_reponse_utilisateur(utilisateur_demo),
        )

    maintenant = datetime.now(timezone.utc)
    document_utilisateur = {
        "nom": utilisateur.nom,
        "email": utilisateur.email,
        "mot_de_passe_hash": generer_hash_mot_de_passe(utilisateur.mot_de_passe),
        "favorites": [],
        "favorite_quotes": {},
        "cree_le": maintenant,
        "modifie_le": maintenant,
    }

    try:
        resultat = collection_utilisateurs.insert_one(document_utilisateur)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte avec cet email existe deja",
        )

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
    """Authentifie un utilisateur existant."""
    collection_utilisateurs = obtenir_collection_utilisateurs()

    if collection_utilisateurs is None:
        if utilisateur.email == "demo@test.com" and utilisateur.mot_de_passe == "demo123":
            utilisateur_demo = get_demo_user_by_email(utilisateur.email)
            if utilisateur_demo is None:
                utilisateur_demo = upsert_demo_user("demo_123", "Utilisateur Demo", "demo@test.com")

            return ReponseJeton(
                access_token=creer_jeton_acces(
                    {"sub": utilisateur_demo["id"], "email": utilisateur_demo["email"]}
                ),
                user=construire_reponse_utilisateur(utilisateur_demo),
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    utilisateur_trouve = collection_utilisateurs.find_one({"email": utilisateur.email})
    if not utilisateur_trouve or not verifier_mot_de_passe(
        utilisateur.mot_de_passe,
        utilisateur_trouve["mot_de_passe_hash"],
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    jeton_acces = creer_jeton_acces(
        {"sub": str(utilisateur_trouve["_id"]), "email": utilisateur_trouve["email"]}
    )
    return ReponseJeton(
        access_token=jeton_acces,
        user=construire_reponse_utilisateur(utilisateur_trouve),
    )


@router.post("/logout", summary="Deconnexion")
async def deconnexion():
    """Retourne une confirmation symbolique de deconnexion."""
    return {"status": "success", "message": "Deconnexion reussie"}
