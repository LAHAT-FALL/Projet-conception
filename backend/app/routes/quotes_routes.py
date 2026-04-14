"""
Routes REST de gestion des citations et des favoris.

Ce module expose les endpoints suivants :
- GET  /random              : citation aleatoire (avec filtres optionnels auteur/categorie)
- GET  /daily               : citation du jour (meme citation pour tous toute la journee)
- GET  /translate           : traduction d'une citation en francais (MyMemory)
- GET  /favorites           : liste des citations favorites de l'utilisateur
- POST /favorites/{id}      : ajout d'une citation aux favoris
- PATCH /favorites/{id}/note: modification de la note personnelle sur un favori
- DELETE /favorites/{id}    : retrait d'une citation des favoris

Toutes les routes sont protegees par JWT (Bearer token obligatoire).
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
from app.demo_store import (
    add_demo_favorite,
    get_demo_user_by_id,
    remove_demo_favorite,
    update_demo_favorite_note,
)

router = APIRouter()

# Cle API Ninjas lue depuis le fichier .env
CLE_API_NINJAS = os.getenv("NINJAS_API_KEY")

# URL du service externe de citations API Ninjas
URL_API_NINJAS = "https://api.api-ninjas.com/v2/randomquotes"

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
    """
    note: str = Field(default="", max_length=500)


# Liste de citations de secours utilisee quand API Ninjas est indisponible.
# Garantit que l'application reste fonctionnelle meme sans connexion internet.
CITATIONS_SECOURS = [
    # life
    {"text": "La vie est un mystere qu'il faut vivre, et non un probleme a resoudre.", "author": "Gandhi", "category": "life"},
    {"text": "La vie, ce n'est pas d'attendre que les orages passent, c'est d'apprendre a danser sous la pluie.", "author": "Seneque", "category": "life"},
    {"text": "Carpe diem, quam minimum credula postero.", "author": "Horace", "category": "life"},
    {"text": "Life is what happens when you're busy making other plans.", "author": "John Lennon", "category": "life"},
    {"text": "In the end, it's not the years in your life that count. It's the life in your years.", "author": "Abraham Lincoln", "category": "life"},
    # success
    {"text": "Le succes, c'est d'aller d'echec en echec sans perdre son enthousiasme.", "author": "Winston Churchill", "category": "success"},
    {"text": "Le plus grand risque est de ne prendre aucun risque.", "author": "Mark Zuckerberg", "category": "success"},
    {"text": "Success is not final, failure is not fatal: it is the courage to continue that counts.", "author": "Winston Churchill", "category": "success"},
    {"text": "The secret of success is to do the common thing uncommonly well.", "author": "John D. Rockefeller", "category": "success"},
    # inspirational
    {"text": "Le seul veritable voyage est celui qu'on fait au-dedans de soi.", "author": "Marcel Proust", "category": "inspirational"},
    {"text": "Vis comme si tu devais mourir demain. Apprends comme si tu devais vivre toujours.", "author": "Mahatma Gandhi", "category": "inspirational"},
    {"text": "The only way to do great work is to love what you do.", "author": "Steve Jobs", "category": "inspirational"},
    {"text": "Believe you can and you're halfway there.", "author": "Theodore Roosevelt", "category": "inspirational"},
    # happiness
    {"text": "Le bonheur est parfois cache dans l'inconnu.", "author": "Victor Hugo", "category": "happiness"},
    {"text": "Happiness is not something ready-made. It comes from your own actions.", "author": "Dalai Lama", "category": "happiness"},
    {"text": "The most important thing is to enjoy your life — to be happy — it's all that matters.", "author": "Audrey Hepburn", "category": "happiness"},
    # wisdom
    {"text": "Agis avec bonte, mais n'attends pas de reconnaissance.", "author": "Confucius", "category": "wisdom"},
    {"text": "Connais-toi toi-meme.", "author": "Socrate", "category": "wisdom"},
    {"text": "The fool doth think he is wise, but the wise man knows himself to be a fool.", "author": "William Shakespeare", "category": "wisdom"},
    {"text": "Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.", "author": "Rumi", "category": "wisdom"},
    # knowledge
    {"text": "Savoir s'etonner est le premier pas du coeur vers la decouverte.", "author": "Louis Pasteur", "category": "knowledge"},
    {"text": "Le savoir est la seule richesse qui ne peut nous etre volee.", "author": "Socrate", "category": "knowledge"},
    {"text": "Je pense, donc je suis.", "author": "Rene Descartes", "category": "knowledge"},
    {"text": "L'imagination est plus importante que le savoir.", "author": "Albert Einstein", "category": "knowledge"},
    {"text": "An investment in knowledge pays the best interest.", "author": "Benjamin Franklin", "category": "knowledge"},
    {"text": "The more that you read, the more things you will know.", "author": "Dr. Seuss", "category": "knowledge"},
    # art
    {"text": "La simplicite est la sophistication supreme.", "author": "Leonardo da Vinci", "category": "art"},
    {"text": "Every artist was first an amateur.", "author": "Ralph Waldo Emerson", "category": "art"},
    {"text": "Art enables us to find ourselves and lose ourselves at the same time.", "author": "Thomas Merton", "category": "art"},
    # love
    {"text": "Aimer, c'est trouver sa richesse hors de soi.", "author": "Alain", "category": "love"},
    {"text": "On n'aime bien qu'une seule fois, c'est la premiere.", "author": "La Bruyere", "category": "love"},
    {"text": "The best thing to hold onto in life is each other.", "author": "Audrey Hepburn", "category": "love"},
    {"text": "Where there is love there is life.", "author": "Mahatma Gandhi", "category": "love"},
    # courage
    {"text": "Le courage, c'est de chercher la verite et de la dire.", "author": "Jean Jaures", "category": "courage"},
    {"text": "La bravure, c'est la peur qui a dit ses prieres.", "author": "Dorothy Bernard", "category": "courage"},
    {"text": "Courage is not the absence of fear, but acting in spite of it.", "author": "Mark Twain", "category": "courage"},
    {"text": "It takes courage to grow up and become who you really are.", "author": "E.E. Cummings", "category": "courage"},
    # friendship
    {"text": "L'amitie double les joies et divise les peines.", "author": "Francis Bacon", "category": "friendship"},
    {"text": "Un ami, c'est quelqu'un qui vous connait bien et qui vous aime quand meme.", "author": "Elbert Hubbard", "category": "friendship"},
    {"text": "A real friend is one who walks in when the rest of the world walks out.", "author": "Walter Winchell", "category": "friendship"},
    {"text": "Friendship is the only cement that will ever hold the world together.", "author": "Woodrow Wilson", "category": "friendship"},
    # faith
    {"text": "La foi, c'est monter le premier pas meme quand on ne voit pas l'escalier.", "author": "Martin Luther King", "category": "faith"},
    {"text": "Faith is taking the first step even when you don't see the whole staircase.", "author": "Martin Luther King", "category": "faith"},
    # nature
    {"text": "La nature est le seul livre qui offre un contenu precieux sur toutes ses pages.", "author": "Goethe", "category": "nature"},
    {"text": "Look deep into nature, and then you will understand everything better.", "author": "Albert Einstein", "category": "nature"},
    {"text": "In every walk with nature, one receives far more than he seeks.", "author": "John Muir", "category": "nature"},
    # leadership
    {"text": "Le leadership, c'est l'art de faire faire aux autres ce que vous voulez.", "author": "Dwight D. Eisenhower", "category": "leadership"},
    {"text": "A leader is one who knows the way, goes the way, and shows the way.", "author": "John C. Maxwell", "category": "leadership"},
    {"text": "Leadership is not about being in charge. It is about taking care of those in your charge.", "author": "Simon Sinek", "category": "leadership"},
    # education
    {"text": "L'education est l'arme la plus puissante pour changer le monde.", "author": "Nelson Mandela", "category": "education"},
    {"text": "Education is not the filling of a pail, but the lighting of a fire.", "author": "W.B. Yeats", "category": "education"},
    {"text": "The roots of education are bitter, but the fruit is sweet.", "author": "Aristotle", "category": "education"},
    # funny
    {"text": "I am so clever that sometimes I don't understand a single word of what I am saying.", "author": "Oscar Wilde", "category": "funny"},
    {"text": "People say nothing is impossible, but I do nothing every day.", "author": "A.A. Milne", "category": "funny"},
]


async def obtenir_utilisateur_courant(authorization: Optional[str] = Header(None)):
    """
    Dependance FastAPI : extrait et valide le token JWT du header Authorization.

    Format attendu dans la requete HTTP :
        Authorization: Bearer <token_jwt>

    Retourne l'identifiant utilisateur (sub) si le token est valide.
    Leve HTTP 401 dans tous les autres cas (absent, mal forme, expire).
    """
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
            # Le champ 'note' vient du document utilisateur (inline), pas de la collection quotes
            note = citations_embarquees.get(identifiant_citation, {}).get("note")
            donnees = {**citation, "note": note}
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


def seeder_citations_secours():
    """
    Insere les CITATIONS_SECOURS dans MongoDB si la collection est vide.
    Appele au demarrage pour garantir un pool de fallback persistant.
    """
    collection_citations = obtenir_collection_citations()
    if collection_citations is None:
        return

    if collection_citations.count_documents({}) == 0:
        print("[Citations] Collection vide — insertion des citations de secours initiales")
        for c in CITATIONS_SECOURS:
            citation = normaliser_citation(c["text"], c["author"], c.get("category", "general"))
            persister_citation_si_possible(citation)
        print(f"[Citations] {len(CITATIONS_SECOURS)} citations inserees en base")


def charger_citation_aleatoire_depuis_mongodb(
    category: Optional[str] = None,
    author: Optional[str] = None,
) -> Optional[dict]:
    """
    Recupere une citation aleatoire depuis MongoDB via $sample.

    Applique les filtres categorie et auteur si fournis.
    Retourne None si aucun resultat ou si MongoDB est indisponible.
    Ne fait PAS de retry sans filtres : l'absence de resultat est signalee
    au code appelant pour qu'il retourne une erreur appropriee.
    """
    collection_citations = obtenir_collection_citations()
    if collection_citations is None:
        return None

    filtre: dict = {}
    if category:
        filtre["category"] = category.lower().strip()
    if author:
        filtre["author"] = {"$regex": author.strip(), "$options": "i"}

    pipeline = []
    if filtre:
        pipeline.append({"$match": filtre})
    pipeline.append({"$sample": {"size": 1}})

    resultats = list(collection_citations.aggregate(pipeline))
    if not resultats:
        return None

    doc = resultats[0]
    return {
        "id": doc["id"],
        "text": doc["text"],
        "author": doc["author"],
        "category": doc.get("category", "general"),
    }


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
    1. API Ninjas (si cle configuree) → citation persistee en MongoDB
    2. MongoDB (pool accumule) → citation aleatoire avec filtres
    3. CITATIONS_SECOURS (liste locale) → dernier recours
    """
    print(f"[Citations] Generation de citation pour l'utilisateur {utilisateur_id} (category={category}, author={author})")

    if CLE_API_NINJAS:
        try:
            params_ninjas = {}
            if category:
                params_ninjas["categories"] = category.lower().strip()
            if author:
                params_ninjas["author"] = author.strip()

            reponse = requests.get(
                URL_API_NINJAS,
                headers={"X-Api-Key": CLE_API_NINJAS},
                params=params_ninjas,
                timeout=5,
            )

            if reponse.status_code == 200:
                donnees = reponse.json()
                if donnees:
                    auteur_retourne = donnees[0]["author"]
                    # v2/randomquotes retourne "categories" comme tableau
                    categories_retournees = donnees[0].get("categories", [])

                    # Validation auteur
                    auteur_invalide = author and author.lower().strip() not in auteur_retourne.lower()
                    # Validation categorie : la categorie demandee doit etre dans le tableau
                    categorie_invalide = category and category.lower().strip() not in [c.lower() for c in categories_retournees]

                    if auteur_invalide:
                        print(f"[Citations] Rejet API Ninjas — auteur {auteur_retourne!r} != filtre {author!r}")
                    elif categorie_invalide:
                        print(f"[Citations] Rejet API Ninjas — categories {categories_retournees!r} ne contient pas {category!r}")
                    else:
                        citation = normaliser_citation(
                            texte=donnees[0]["quote"],
                            auteur=auteur_retourne,
                            categorie=category or (categories_retournees[0] if categories_retournees else "general"),
                        )
                        persister_citation_si_possible(citation)
                        return ReponseCitation(**citation)

            print(f"[Citations] API Ninjas a retourne {reponse.status_code} - params={params_ninjas} - body={reponse.text}")

        except Exception as exc:
            print(f"[Citations] Erreur API Ninjas: {exc}")

    # Fallback : MongoDB (citations accumulees), avec les memes filtres
    citation_db = charger_citation_aleatoire_depuis_mongodb(category, author)
    if citation_db:
        print(f"[Citations] Fallback MongoDB utilise (category={category}, author={author})")
        return ReponseCitation(**citation_db)

    # Aucun resultat avec filtre auteur : on retourne une erreur explicite
    if author:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Aucune citation de l\'auteur "{author}" n\'a été trouvée.',
        )

    # Sans filtre et sans MongoDB : dernier recours sur la liste locale
    print("[Citations] Fallback local utilise (aucun filtre, MongoDB indisponible)")
    citation = random.choice(CITATIONS_SECOURS)
    return ReponseCitation(**normaliser_citation(citation["text"], citation["author"], citation.get("category") or "general"))


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
    - En mode fallback : selection deterministe basee sur le numero du jour calendaire
      (ex: 20260329 % 15 = index dans CITATIONS_SECOURS)

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
                    persister_citation_si_possible(citation)
                    _cache_citation_jour = {"date": aujourd_hui, "citation": citation}
                    return ReponseCitation(**citation)
        except Exception as exc:
            print(f"[Citations] Erreur API Ninjas pour citation du jour: {exc}")

    # Fallback 1 : MongoDB
    citation_db = charger_citation_aleatoire_depuis_mongodb()
    if citation_db:
        print("[Citations] Citation du jour depuis MongoDB")
        _cache_citation_jour = {"date": aujourd_hui, "citation": citation_db}
        return ReponseCitation(**citation_db)

    # Fallback 2 : liste locale, selection deterministe par date
    numero_jour = int(aujourd_hui.replace("-", "")) % len(CITATIONS_SECOURS)
    citation_fallback = normaliser_citation(
        CITATIONS_SECOURS[numero_jour]["text"],
        CITATIONS_SECOURS[numero_jour]["author"],
        CITATIONS_SECOURS[numero_jour].get("category", "general"),
    )
    _cache_citation_jour = {"date": aujourd_hui, "citation": citation_fallback}
    return ReponseCitation(**citation_fallback)


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
