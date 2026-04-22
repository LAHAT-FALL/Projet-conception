"""
Routes REST de gestion des citations et des favoris.

Ce module expose les endpoints suivants :
- GET  /random                   : citation aleatoire (filtres optionnels auteur/categorie)
- GET  /daily                    : citation du jour (meme citation pour tous toute la journee)
- GET  /translate                : traduction d'une citation en francais (MyMemory)
- GET  /favorites                : liste des citations favorites de l'utilisateur
- POST /favorites/{id}           : ajout d'une citation aux favoris
- PATCH /favorites/{id}/note     : modification de la note personnelle sur un favori
- PATCH /favorites/{id}/tag      : modification du tag personnalise sur un favori
- DELETE /favorites/{id}         : retrait d'une citation des favoris

Toutes les routes sont protegees par JWT (Bearer token obligatoire).
"""

import hashlib
import html
import os
import random
import re
from datetime import datetime, timezone
from typing import Optional

import requests
from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

# Pattern valide pour un identifiant de citation genere par construire_identifiant_citation()
_PATTERN_QUOTE_ID = re.compile(r"^quote_[a-f0-9]{16}$")

from app.database import obtenir_collection_citations, obtenir_collection_utilisateurs
from app.dependencies import obtenir_utilisateur_courant
from app.demo_store import (
    add_demo_favorite,
    get_demo_user_by_id,
    remove_demo_favorite,
    update_demo_favorite_note,
    update_demo_favorite_tag,
)

router = APIRouter()

# Cle API Ninjas lue depuis le fichier .env
CLE_API_NINJAS = os.getenv("NINJAS_API_KEY")

# URLs du service externe de citations API Ninjas (v2)
# /v2/quotes       : filtre par categories/author, ordre deterministe — utilise quand un filtre est actif
# /v2/randomquotes : aucun filtre, retourne une citation vraiment aleatoire
# /v2/quoteoftheday : meme citation pour tous pendant 24h
URL_API_NINJAS_QUOTES = "https://api.api-ninjas.com/v2/quotes"
URL_API_NINJAS_RANDOM = "https://api.api-ninjas.com/v2/randomquotes"
URL_API_NINJAS_DAILY = "https://api.api-ninjas.com/v2/quoteoftheday"

# Categories acceptees par l'API Ninjas v2 (toute autre valeur est ignoree)
CATEGORIES_V2_VALIDES = {
    "wisdom", "philosophy", "life", "truth", "inspirational",
    "relationships", "love", "faith", "humor", "success",
    "courage", "happiness", "art", "writing", "fear",
    "nature", "time", "freedom", "death", "leadership",
}

# URL du service de traduction MyMemory (gratuit, sans cle API)
URL_MYMEMORY = "https://api.mymemory.translated.net/get"

# Cache en memoire pour la citation du jour.
# Reinitialise au redemarrage du serveur, suffisant pour un projet academique.
# Pour une persistance reelle, stocker en MongoDB avec un TTL de 24 heures.
_cache_citation_jour: dict = {"date": None, "citation": None}


class ReponseCitation(BaseModel):
    """
    Modele de donnees representant une citation renvoyee au client.

    Champs :
    - id       : identifiant unique stable (hash SHA-1 du contenu)
    - text     : texte de la citation
    - author   : auteur de la citation
    - category : categorie thematique (optionnel)
    - note     : note personnelle de l'utilisateur sur ce favori (optionnel)
    """
    id: str
    text: str
    author: str
    category: Optional[str] = None
    note: Optional[str] = None
    tag: Optional[str] = None


class ReponseFavoris(BaseModel):
    """
    Modele de donnees pour la liste des favoris.

    Champs :
    - favorites       : liste des IDs de citations favorites (ordre conserve)
    - favorite_quotes : liste des details complets de chaque citation
    """
    favorites: list[str] = Field(default_factory=list)
    favorite_quotes: list[ReponseCitation] = Field(default_factory=list)


class ReponseTraduction(BaseModel):
    """
    Modele de donnees pour une traduction retournee au client.

    Champs :
    - texte_original : texte soumis a la traduction
    - texte_traduit  : resultat de la traduction en francais
    - langue_source  : code ISO de la langue d'origine (ex: 'en')
    - langue_cible   : toujours 'fr' pour ce service
    """
    texte_original: str
    texte_traduit: str
    langue_source: str
    langue_cible: str


class DonneesNote(BaseModel):
    """
    Corps de la requete PATCH pour modifier la note sur un favori.

    La note peut etre vide (chaine vide) pour effacer une note existante.
    Limitee a 500 caracteres pour eviter les abus.
    Le contenu est echappe pour prevenir les injections XSS.
    """
    note: str = Field(default="", max_length=500)

    @field_validator("note")
    @classmethod
    def sanitiser_note(cls, valeur: str) -> str:
        """Echappe les caracteres HTML pour prevenir le stockage de contenu XSS."""
        return html.escape(valeur.strip())


def piocher_citation_depuis_mongodb(
    author: Optional[str] = None,
    category: Optional[str] = None,
) -> Optional[dict]:
    """
    Pioche une citation aleatoire dans la collection MongoDB 'quotes'.
    Utilise $sample pour eviter tout biais de selection.

    Filtres optionnels (appliques uniquement s'ils sont fournis) :
    - author   : recherche insensible a la casse sur le champ author
    - category : correspondance exacte sur le champ category

    Retourne un dict normalise {id, text, author, category} ou None si la
    collection est vide ou si aucun document ne correspond aux filtres.
    """
    collection = obtenir_collection_citations()
    if collection is None:
        return None

    filtre: dict = {}
    if author:
        filtre["author"] = {"$regex": author.strip(), "$options": "i"}
    if category:
        filtre["category"] = category.lower().strip()

    # Relaxation progressive : si le filtre combine ne donne rien, on retire
    # la categorie pour ne pas renvoyer une erreur sur un auteur valide.
    for tentative in [filtre, {"author": filtre["author"]} if author else None, {}]:
        if tentative is None:
            continue
        resultats = list(collection.aggregate([
            {"$match": tentative},
            {"$sample": {"size": 1}},
        ]))
        if resultats:
            doc = resultats[0]
            return normaliser_citation(doc["text"], doc["author"], doc.get("category"))

    return None



def construire_identifiant_citation(texte: str, auteur: str, categorie: Optional[str] = None) -> str:
    """
    Construit un identifiant stable et reproductible pour une citation.

    SHA-1 est utilise ici comme fonction de hachage de contenu uniquement
    (pas pour la securite cryptographique). Les 16 premiers caracteres suffisent
    pour garantir l'unicite des citations dans la base de donnees.
    """
    contenu = f"{auteur.strip().lower()}|{texte.strip().lower()}|{(categorie or 'general').strip().lower()}"
    empreinte = hashlib.sha1(contenu.encode("utf-8")).hexdigest()[:16]
    return f"quote_{empreinte}"


def normaliser_citation(texte: str, auteur: str, categorie: Optional[str] = None) -> dict:
    """
    Nettoie et normalise les champs d'une citation avant sauvegarde ou envoi.
    """
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
    """
    Reconstruit la liste des citations favorites dans l'ordre original.

    Cherche chaque citation d'abord dans citations_stockees (MongoDB),
    puis dans citations_embarquees (champ inline du document utilisateur).
    """
    citations_embarquees = citations_embarquees or {}
    citations_stockees = citations_stockees or {}
    resultat = []

    for identifiant_citation in identifiants_favoris:
        citation = citations_stockees.get(identifiant_citation) or citations_embarquees.get(identifiant_citation)
        if citation:
            # 'note' et 'tag' viennent du document utilisateur (inline), pas de la collection quotes
            inline = citations_embarquees.get(identifiant_citation, {})
            donnees = {**citation, "note": inline.get("note"), "tag": inline.get("tag")}
            resultat.append(ReponseCitation(**donnees))

    return resultat


def charger_citations_depuis_mongodb(identifiants_favoris: list[str]) -> dict:
    """
    Charge en une seule requete toutes les citations favorites depuis MongoDB.
    Utilise l'operateur $in pour eviter N requetes individuelles.
    """
    collection_citations = obtenir_collection_citations()

    if collection_citations is None or not identifiants_favoris:
        return {}

    documents = collection_citations.find({"id": {"$in": identifiants_favoris}})
    return {document["id"]: document for document in documents}


def persister_citation_si_possible(citation: dict):
    """
    Sauvegarde la citation dans la collection 'quotes' si MongoDB est disponible.
    Utilise un upsert base sur l'identifiant stable pour eviter les doublons.
    """
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
async def obtenir_citation_aleatoire(
    category: Optional[str] = None,
    author: Optional[str] = None,
    utilisateur_id: str = Depends(obtenir_utilisateur_courant),
):
    """
    Retourne une citation aleatoire, avec filtres optionnels.

    Parametres de requete optionnels :
    - category : filtrer par categorie (ex: 'life', 'success', 'happiness')
    - author   : filtrer par auteur (recherche partielle)

    Strategie :
    1. Si la cle API Ninjas est configuree, appel au service externe avec les filtres
    2. Si l'appel echoue ou la cle est absente, citation aleatoire depuis MongoDB
       (filtres author/category appliques via $sample + $match)
    """
    print(f"[Citations] Generation de citation pour l'utilisateur {utilisateur_id} (category={category}, author={author})")

    if CLE_API_NINJAS:
        try:
            # La categorie n'est envoyee que si elle fait partie des 20 valeurs valides v2.
            params_ninjas = {}
            categorie_normalisee = category.lower().strip() if category else None
            if categorie_normalisee and categorie_normalisee in CATEGORIES_V2_VALIDES:
                params_ninjas["categories"] = categorie_normalisee
            elif category:
                print(f"[Citations] Categorie ignoree (non valide pour v2) : {category!r}")
            if author:
                params_ninjas["author"] = author.strip()

            # /v2/quotes supporte les filtres (categories, author) et retourne une liste
            # dans un ordre deterministe. On ajoute un offset aleatoire + limit=10 pour
            # varier les resultats a chaque appel sur le meme filtre.
            # /v2/randomquotes est utilise uniquement sans filtre (vraiment aleatoire).
            if params_ninjas:
                url_ninjas = URL_API_NINJAS_QUOTES
                params_ninjas["limit"] = 10
                params_ninjas["offset"] = random.randint(0, 99)
            else:
                url_ninjas = URL_API_NINJAS_RANDOM

            reponse = requests.get(
                url_ninjas,
                headers={"X-Api-Key": CLE_API_NINJAS},
                params=params_ninjas,
                timeout=5,
            )

            if reponse.status_code == 200:
                donnees = reponse.json()
                # Si l'offset depasse le total, l'API retourne une liste vide.
                # On relance avec offset=0 pour garantir un resultat.
                if isinstance(donnees, list) and not donnees and params_ninjas.get("offset", 0) > 0:
                    params_ninjas["offset"] = 0
                    reponse = requests.get(
                        url_ninjas,
                        headers={"X-Api-Key": CLE_API_NINJAS},
                        params=params_ninjas,
                        timeout=5,
                    )
                    donnees = reponse.json() if reponse.status_code == 200 else []

                # /v2/quotes retourne une liste — on choisit un element aleatoire.
                # /v2/randomquotes peut retourner une liste ou un objet unique.
                if isinstance(donnees, list) and donnees:
                    item = random.choice(donnees)
                elif isinstance(donnees, dict) and donnees.get("quote"):
                    item = donnees
                else:
                    item = None
                if item and item.get("quote"):
                    citation = normaliser_citation(
                        texte=item["quote"],
                        auteur=item.get("author", "Auteur inconnu"),
                        categorie=item.get("category", categorie_normalisee or "general"),
                    )
                    # Si un auteur est demande, verifier que la reponse correspond.
                    # L'API peut ignorer le filtre author quand categories est aussi present.
                    auteur_retourne = citation["author"].lower()
                    auteur_demande = author.lower().strip() if author else None
                    if auteur_demande and auteur_demande not in auteur_retourne:
                        citation_db = piocher_citation_depuis_mongodb(author=author, category=categorie_normalisee)
                        if citation_db:
                            return ReponseCitation(**citation_db)

                    persister_citation_si_possible(citation)
                    return ReponseCitation(**citation)

            print(f"[Citations] API Ninjas a retourne {reponse.status_code}")

        except Exception as exc:
            print(f"[Citations] Erreur API Ninjas: {exc}")

    # Fallback MongoDB : pioche une citation aleatoire dans la collection
    citation_db = piocher_citation_depuis_mongodb(author=author, category=category)
    if citation_db:
        return ReponseCitation(**citation_db)

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Service de citations indisponible et aucune citation en base de donnees.",
    )


@router.get(
    "/daily",
    response_model=ReponseCitation,
    summary="Citation du jour",
)
async def obtenir_citation_du_jour(utilisateur_id: str = Depends(obtenir_utilisateur_courant)):
    """
    Retourne la meme citation pour tous les utilisateurs durant toute la journee.

    Strategie de cache :
    - En mode API Ninjas : appel une seule fois par jour, resultat mis en cache memoire
    - En mode fallback : citation aleatoire piochee dans la collection MongoDB

    Le cache est reinitialise au redemarrage du serveur.
    """
    global _cache_citation_jour

    aujourd_hui = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Retour direct depuis le cache si la citation du jour est deja connue
    if _cache_citation_jour["date"] == aujourd_hui and _cache_citation_jour["citation"]:
        return ReponseCitation(**_cache_citation_jour["citation"])

    if CLE_API_NINJAS:
        try:
            reponse = requests.get(
                URL_API_NINJAS_DAILY,
                headers={"X-Api-Key": CLE_API_NINJAS},
                timeout=5,
            )
            if reponse.status_code == 200:
                donnees = reponse.json()
                # v2 peut retourner une liste ou un objet unique
                item = donnees[0] if isinstance(donnees, list) else donnees
                if item and item.get("quote"):
                    citation = normaliser_citation(
                        texte=item["quote"],
                        auteur=item.get("author", "Auteur inconnu"),
                        categorie=item.get("category", "general"),
                    )
                    persister_citation_si_possible(citation)
                    _cache_citation_jour = {"date": aujourd_hui, "citation": citation}
                    return ReponseCitation(**citation)
        except Exception as exc:
            print(f"[Citations] Erreur API Ninjas pour citation du jour: {exc}")

    # Fallback MongoDB : pioche une citation aleatoire dans la collection
    citation_db = piocher_citation_depuis_mongodb()
    if citation_db:
        _cache_citation_jour = {"date": aujourd_hui, "citation": citation_db}
        return ReponseCitation(**citation_db)

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Service de citations indisponible et aucune citation en base de donnees.",
    )


@router.get(
    "/translate",
    response_model=ReponseTraduction,
    summary="Traduire une citation en francais",
)
async def traduire_citation(
    texte: str,
    langue_source: str = "en",
    utilisateur_id: str = Depends(obtenir_utilisateur_courant),
):
    """
    Traduit un texte vers le francais via le service MyMemory.

    MyMemory est une API de traduction gratuite ne necessitant pas de cle API.
    Parametres de requete :
    - texte          : le texte a traduire (obligatoire)
    - langue_source  : code ISO de la langue source (defaut : 'en' pour anglais)
    """
    if not texte or not texte.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le texte a traduire ne peut pas etre vide",
        )

    texte_propre = texte.strip()

    # MyMemory refuse les textes > 500 caracteres
    if len(texte_propre) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Texte trop long pour la traduction ({len(texte_propre)} caracteres, max 500). Raccourcissez la citation.",
        )

    try:
        reponse = requests.get(
            URL_MYMEMORY,
            params={
                "q": texte_propre,
                "langpair": f"{langue_source}|fr",
            },
            timeout=8,
        )

        if reponse.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Le service de traduction a retourne une erreur ({reponse.status_code})",
            )

        donnees = reponse.json()
        texte_traduit = donnees.get("responseData", {}).get("translatedText", "")

        if not texte_traduit:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Le service de traduction n'a pas retourne de resultat",
            )

        return ReponseTraduction(
            texte_original=texte_propre,
            texte_traduit=texte_traduit,
            langue_source=langue_source,
            langue_cible="fr",
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Impossible de joindre le service de traduction: {exc}",
        )


@router.post(
    "/favorites/{quote_id}",
    summary="Ajouter aux favoris",
)
async def ajouter_aux_favoris(
    quote_id: str,
    citation: Optional[ReponseCitation] = Body(default=None),
    utilisateur_id: str = Depends(obtenir_utilisateur_courant),
):
    """
    Ajoute une citation aux favoris de l'utilisateur connecte.

    Le corps de la requete peut contenir les details complets de la citation.
    La citation est egalement persistee dans la collection 'quotes'.
    """
    # Validation stricte du format de l'ID pour prevenir l'injection NoSQL
    if not _PATTERN_QUOTE_ID.match(quote_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identifiant de citation invalide",
        )
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

    citation_preparee["id"] = quote_id

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


@router.patch(
    "/favorites/{quote_id}/note",
    summary="Modifier la note personnelle sur un favori",
)
async def modifier_note_favori(
    quote_id: str,
    donnees: DonneesNote,
    utilisateur_id: str = Depends(obtenir_utilisateur_courant),
):
    """
    Ajoute ou modifie la note personnelle sur une citation favorite.

    La note est stockee dans le champ inline 'favorite_quotes.<id>.note'
    du document utilisateur. Une note vide ("") efface la note existante.
    """
    if not _PATTERN_QUOTE_ID.match(quote_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identifiant de citation invalide",
        )
    collection_utilisateurs = obtenir_collection_utilisateurs()

    # Mode demo : mise a jour dans le stockage en memoire
    if collection_utilisateurs is None:
        resultat = update_demo_favorite_note(utilisateur_id, quote_id, donnees.note)
        if resultat is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Citation non trouvee dans les favoris",
            )
        return {"status": "success", "message": "Note enregistree (mode demo)"}

    try:
        # Verification que la citation est dans les favoris de l'utilisateur
        utilisateur = collection_utilisateurs.find_one(
            {"_id": ObjectId(utilisateur_id), f"favorite_quotes.{quote_id}": {"$exists": True}}
        )
        if not utilisateur:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Citation non trouvee dans les favoris",
            )

        # Mise a jour ou suppression de la note selon le contenu fourni
        if donnees.note:
            # Note presente : mise a jour du champ
            collection_utilisateurs.update_one(
                {"_id": ObjectId(utilisateur_id)},
                {
                    "$set": {
                        f"favorite_quotes.{quote_id}.note": donnees.note,
                        "modifie_le": datetime.now(timezone.utc),
                    }
                },
            )
        else:
            # Note vide : suppression du champ pour ne pas stocker une chaine vide
            collection_utilisateurs.update_one(
                {"_id": ObjectId(utilisateur_id)},
                {
                    "$unset": {f"favorite_quotes.{quote_id}.note": ""},
                    "$set": {"modifie_le": datetime.now(timezone.utc)},
                },
            )

        return {"status": "success", "message": "Note enregistree"}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la modification de la note: {exc}",
        )


class DonneesTag(BaseModel):
    tag: str = Field(default="", max_length=50)


@router.patch(
    "/favorites/{quote_id}/tag",
    summary="Modifier le tag personnalisé d'un favori",
)
async def modifier_tag_favori(
    quote_id: str,
    donnees: DonneesTag,
    utilisateur_id: str = Depends(obtenir_utilisateur_courant),
):
    """Ajoute, modifie ou supprime le tag personnalisé d'une citation favorite."""
    if not _PATTERN_QUOTE_ID.match(quote_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identifiant de citation invalide",
        )
    collection_utilisateurs = obtenir_collection_utilisateurs()

    if collection_utilisateurs is None:
        resultat = update_demo_favorite_tag(utilisateur_id, quote_id, donnees.tag)
        if resultat is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Citation non trouvee dans les favoris",
            )
        return {"status": "success", "message": "Tag enregistre (mode demo)"}

    try:
        utilisateur = collection_utilisateurs.find_one(
            {"_id": ObjectId(utilisateur_id), f"favorite_quotes.{quote_id}": {"$exists": True}}
        )
        if not utilisateur:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citation non trouvée dans les favoris")

        if donnees.tag:
            collection_utilisateurs.update_one(
                {"_id": ObjectId(utilisateur_id)},
                {"$set": {f"favorite_quotes.{quote_id}.tag": donnees.tag, "modifie_le": datetime.now(timezone.utc)}},
            )
        else:
            collection_utilisateurs.update_one(
                {"_id": ObjectId(utilisateur_id)},
                {"$unset": {f"favorite_quotes.{quote_id}.tag": ""}, "$set": {"modifie_le": datetime.now(timezone.utc)}},
            )

        return {"status": "success", "message": "Tag enregistré"}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get(
    "/favorites",
    response_model=ReponseFavoris,
    summary="Lister les favoris",
)
async def lister_favoris(utilisateur_id: str = Depends(obtenir_utilisateur_courant)):
    """
    Retourne la liste complete des citations favorites de l'utilisateur connecte.

    Strategie de reconstruction :
    1. Lecture des IDs favoris depuis le document utilisateur
    2. Chargement des details depuis la collection quotes (MongoDB)
    3. Fallback sur les details inline du document utilisateur si absent de quotes
    4. Inclusion des notes personnelles depuis les details inline
    """
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
    """
    Retire une citation des favoris de l'utilisateur connecte.

    Supprime l'ID du tableau favorites et les details de favorite_quotes.
    Operation idempotente : pas d'erreur si la citation n'etait pas dans les favoris.
    """
    if not _PATTERN_QUOTE_ID.match(quote_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identifiant de citation invalide",
        )
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
