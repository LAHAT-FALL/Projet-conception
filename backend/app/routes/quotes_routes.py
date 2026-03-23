"""
Routes REST de gestion des citations et des favoris.
"""

import hashlib
import os
import random
from datetime import datetime, timezone
from typing import Optional

import requests
from bson import ObjectId
from fastapi import APIRouter, Body, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import verifier_jeton
from app.database import obtenir_collection_citations, obtenir_collection_utilisateurs
from app.demo_store import add_demo_favorite, get_demo_user_by_id, remove_demo_favorite

router = APIRouter()

CLE_API_NINJAS = os.getenv("NINJAS_API_KEY")
URL_API_NINJAS = "https://api.api-ninjas.com/v1/quotes"


class ReponseCitation(BaseModel):
    """Representation d'une citation renvoyee au client."""

    id: str
    text: str
    author: str
    category: Optional[str] = None


class ReponseFavoris(BaseModel):
    """Structure renvoyee lors de la lecture des favoris."""

    favorites: list[str] = Field(default_factory=list)
    favorite_quotes: list[ReponseCitation] = Field(default_factory=list)


CITATIONS_SECOURS = [
    {"text": "La vie est un mystere qu'il faut vivre, et non un probleme a resoudre.", "author": "Gandhi"},
    {"text": "Le succes, c'est d'aller d'echec en echec sans perdre son enthousiasme.", "author": "Winston Churchill"},
    {"text": "Le seul veritable voyage est celui qu'on fait au-dedans de soi.", "author": "Marcel Proust"},
    {"text": "Savoir s'etonner est le premier pas du coeur vers la decouverte.", "author": "Louis Pasteur"},
    {"text": "La simplicite est la sophistication supreme.", "author": "Leonardo da Vinci"},
    {"text": "Vis comme si tu devais mourir demain. Apprends comme si tu devais vivre toujours.", "author": "Mahatma Gandhi"},
    {"text": "Le bonheur est parfois cache dans l'inconnu.", "author": "Victor Hugo"},
    {"text": "Agis avec bonte, mais n'attends pas de reconnaissance.", "author": "Confucius"},
    {"text": "Le plus grand risque est de ne prendre aucun risque.", "author": "Mark Zuckerberg"},
    {"text": "La vie, ce n'est pas d'attendre que les orages passent, c'est d'apprendre a danser sous la pluie.", "author": "Seneque"},
    {"text": "Le savoir est la seule richesse qui ne peut nous etre volee.", "author": "Socrate"},
    {"text": "Je pense, donc je suis.", "author": "Rene Descartes"},
    {"text": "Carpe diem, quam minimum credula postero.", "author": "Horace"},
    {"text": "Connais-toi toi-meme.", "author": "Socrate"},
    {"text": "L'imagination est plus importante que le savoir.", "author": "Albert Einstein"},
]


async def obtenir_utilisateur_courant(authorization: Optional[str] = Header(None)):
    """Extrait l'identifiant utilisateur depuis le header Authorization."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token d'authentification manquant",
            headers={"WWW-Authenticate": "Bearer"},
        )

    morceaux = authorization.split()
    if len(morceaux) != 2 or morceaux[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Format de token invalide. Utilisez 'Bearer <token>'",
        )

    identifiant_utilisateur = verifier_jeton(morceaux[1])
    if not identifiant_utilisateur:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expire",
        )

    return identifiant_utilisateur


def construire_identifiant_citation(texte: str, auteur: str, categorie: Optional[str] = None) -> str:
    """Construit un identifiant stable pour une citation."""
    contenu = f"{auteur.strip().lower()}|{texte.strip().lower()}|{(categorie or 'general').strip().lower()}"
    empreinte = hashlib.sha1(contenu.encode("utf-8")).hexdigest()[:16]
    return f"quote_{empreinte}"


def normaliser_citation(texte: str, auteur: str, categorie: Optional[str] = None) -> dict:
    """Nettoie une citation avant de la sauvegarder ou de la renvoyer."""
    texte_propre = texte.strip()
    auteur_propre = auteur.strip() or "Auteur inconnu"
    categorie_propre = (categorie or "general").strip() or "general"
    return {
        "id": construire_identifiant_citation(texte_propre, auteur_propre, categorie_propre),
        "text": texte_propre,
        "author": auteur_propre,
        "category": categorie_propre,
    }


def reconstruire_citations_favorites(
    identifiants_favoris: list[str],
    citations_embarquees: Optional[dict] = None,
    citations_stockees: Optional[dict] = None,
) -> list[ReponseCitation]:
    """Reconstruit les citations favorites dans le meme ordre que la liste des IDs."""
    citations_embarquees = citations_embarquees or {}
    citations_stockees = citations_stockees or {}
    resultat = []

    for identifiant_citation in identifiants_favoris:
        citation = citations_stockees.get(identifiant_citation) or citations_embarquees.get(identifiant_citation)
        if citation:
            resultat.append(ReponseCitation(**citation))

    return resultat


def charger_citations_depuis_mongodb(identifiants_favoris: list[str]) -> dict:
    """Charge les citations favorites correspondantes depuis la collection MongoDB."""
    collection_citations = obtenir_collection_citations()
    if collection_citations is None or not identifiants_favoris:
        return {}

    documents = collection_citations.find({"id": {"$in": identifiants_favoris}})
    return {document["id"]: document for document in documents}


def persister_citation_si_possible(citation: dict):
    """Sauvegarde la citation dans la collection `quotes` si MongoDB est disponible."""
    collection_citations = obtenir_collection_citations()
    if collection_citations is None:
        return

    maintenant = datetime.now(timezone.utc)
    collection_citations.update_one(
        {"id": citation["id"]},
        {
            "$set": {
                "id": citation["id"],
                "text": citation["text"],
                "author": citation["author"],
                "category": citation.get("category", "general"),
                "modifie_le": maintenant,
            },
            "$setOnInsert": {"cree_le": maintenant},
        },
        upsert=True,
    )


@router.get(
    "/random",
    response_model=ReponseCitation,
    summary="Citation aleatoire",
)
async def obtenir_citation_aleatoire(utilisateur_id: str = Depends(obtenir_utilisateur_courant)):
    """Retourne une citation aleatoire depuis API Ninjas ou la liste de secours."""
    print(f"[Citations] Generation de citation pour l'utilisateur {utilisateur_id}")

    if CLE_API_NINJAS:
        try:
            reponse = requests.get(
                URL_API_NINJAS,
                headers={"X-Api-Key": CLE_API_NINJAS},
                timeout=5,
            )
            if reponse.status_code == 200:
                donnees = reponse.json()
                if donnees:
                    citation = normaliser_citation(
                        texte=donnees[0]["quote"],
                        auteur=donnees[0]["author"],
                        categorie=donnees[0].get("category", "general"),
                    )
                    return ReponseCitation(**citation)

            print(f"[Citations] API Ninjas a retourne {reponse.status_code}")
        except Exception as exc:
            print(f"[Citations] Erreur API Ninjas: {exc}")

    citation = random.choice(CITATIONS_SECOURS)
    return ReponseCitation(**normaliser_citation(citation["text"], citation["author"], "general"))


@router.post(
    "/favorites/{quote_id}",
    summary="Ajouter aux favoris",
)
async def ajouter_aux_favoris(
    quote_id: str,
    citation: Optional[ReponseCitation] = Body(default=None),
    utilisateur_id: str = Depends(obtenir_utilisateur_courant),
):
    """Ajoute une citation aux favoris de l'utilisateur."""
    collection_utilisateurs = obtenir_collection_utilisateurs()

    if citation is not None:
        citation_preparee = normaliser_citation(
            texte=citation.text,
            auteur=citation.author,
            categorie=citation.category,
        )
    else:
        citation_preparee = {
            "id": quote_id,
            "text": f"Citation #{quote_id}",
            "author": "Auteur inconnu",
            "category": "general",
        }

    citation_preparee["id"] = quote_id if citation is None else citation_preparee["id"]

    if collection_utilisateurs is None:
        utilisateur_demo = add_demo_favorite(utilisateur_id, citation_preparee)
        return {
            "status": "success",
            "message": "Citation ajoutee aux favoris (mode demo)",
            "quote_id": citation_preparee["id"],
            "favorites": utilisateur_demo["favorites"],
        }

    try:
        utilisateur = collection_utilisateurs.find_one({"_id": ObjectId(utilisateur_id)})
        if not utilisateur:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouve",
            )

        persister_citation_si_possible(citation_preparee)
        citation_deja_presente = citation_preparee["id"] in utilisateur.get("favorites", [])

        collection_utilisateurs.update_one(
            {"_id": ObjectId(utilisateur_id)},
            {
                "$addToSet": {"favorites": citation_preparee["id"]},
                "$set": {
                    f"favorite_quotes.{citation_preparee['id']}": citation_preparee,
                    "modifie_le": datetime.now(timezone.utc),
                },
            },
        )

        return {
            "status": "info" if citation_deja_presente else "success",
            "message": (
                "Cette citation est deja dans vos favoris"
                if citation_deja_presente
                else "Citation ajoutee aux favoris"
            ),
            "quote_id": citation_preparee["id"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'ajout aux favoris: {exc}",
        )


@router.get(
    "/favorites",
    response_model=ReponseFavoris,
    summary="Lister les favoris",
)
async def lister_favoris(utilisateur_id: str = Depends(obtenir_utilisateur_courant)):
    """Retourne la liste des favoris et le detail complet de chaque citation."""
    collection_utilisateurs = obtenir_collection_utilisateurs()

    if collection_utilisateurs is None:
        utilisateur_demo = get_demo_user_by_id(utilisateur_id)
        if not utilisateur_demo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur demo non trouve",
            )

        identifiants_favoris = utilisateur_demo.get("favorites", [])
        citations_favorites = reconstruire_citations_favorites(
            identifiants_favoris=identifiants_favoris,
            citations_embarquees=utilisateur_demo.get("favorite_quotes", {}),
        )
        return ReponseFavoris(favorites=identifiants_favoris, favorite_quotes=citations_favorites)

    try:
        utilisateur = collection_utilisateurs.find_one({"_id": ObjectId(utilisateur_id)})
        if not utilisateur:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouve",
            )

        identifiants_favoris = utilisateur.get("favorites", [])
        citations_favorites = reconstruire_citations_favorites(
            identifiants_favoris=identifiants_favoris,
            citations_embarquees=utilisateur.get("favorite_quotes", {}),
            citations_stockees=charger_citations_depuis_mongodb(identifiants_favoris),
        )
        return ReponseFavoris(favorites=identifiants_favoris, favorite_quotes=citations_favorites)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la recuperation des favoris: {exc}",
        )


@router.delete(
    "/favorites/{quote_id}",
    summary="Retirer des favoris",
)
async def retirer_des_favoris(
    quote_id: str,
    utilisateur_id: str = Depends(obtenir_utilisateur_courant),
):
    """Retire une citation des favoris de l'utilisateur."""
    collection_utilisateurs = obtenir_collection_utilisateurs()

    if collection_utilisateurs is None:
        utilisateur_demo = remove_demo_favorite(utilisateur_id, quote_id)
        if utilisateur_demo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur demo non trouve",
            )

        return {
            "status": "success",
            "message": "Citation retiree des favoris (mode demo)",
            "quote_id": quote_id,
            "favorites": utilisateur_demo["favorites"],
        }

    try:
        resultat = collection_utilisateurs.update_one(
            {"_id": ObjectId(utilisateur_id)},
            {
                "$pull": {"favorites": quote_id},
                "$unset": {f"favorite_quotes.{quote_id}": ""},
                "$set": {"modifie_le": datetime.now(timezone.utc)},
            },
        )

        if resultat.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouve",
            )

        if resultat.modified_count == 0:
            return {
                "status": "info",
                "message": "Cette citation n'etait pas dans vos favoris",
                "quote_id": quote_id,
            }

        return {
            "status": "success",
            "message": "Citation retiree des favoris",
            "quote_id": quote_id,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors du retrait des favoris: {exc}",
        )
