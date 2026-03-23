"""
Gestion de la connexion MongoDB pour QuoteKeeper.
"""

import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError

load_dotenv()

URL_MONGODB = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
NOM_BASE_DONNEES = os.getenv("MONGODB_DB_NAME", "quote_keeper")

print(f"[MongoDB] Tentative de connexion a {URL_MONGODB}")

client_mongodb = None
base_donnees = None
collection_utilisateurs = None
collection_citations = None


def masquer_url_mongodb(url: str) -> str:
    """Masque le mot de passe eventuel d'une URL MongoDB avant affichage."""
    if "@" not in url or "://" not in url:
        return url

    scheme, reste = url.split("://", 1)
    identifiants, suffixe = reste.split("@", 1)
    if ":" not in identifiants:
        return f"{scheme}://***@{suffixe}"

    nom_utilisateur, _ = identifiants.split(":", 1)
    return f"{scheme}://{nom_utilisateur}:***@{suffixe}"


def initialiser_index():
    """Cree les index utiles a la persistance des utilisateurs et des citations."""
    if collection_utilisateurs is None or collection_citations is None:
        return

    collection_utilisateurs.create_index("email", unique=True)
    collection_citations.create_index("id", unique=True)
    collection_citations.create_index([("author", 1), ("category", 1)])


try:
    client_mongodb = MongoClient(URL_MONGODB, serverSelectionTimeoutMS=5000)
    client_mongodb.admin.command("ping")

    base_donnees = client_mongodb[NOM_BASE_DONNEES]
    collection_utilisateurs = base_donnees["users"]
    collection_citations = base_donnees["quotes"]

    initialiser_index()

    print("[MongoDB] Connexion etablie avec succes")
    print(f"[MongoDB] Base de donnees active: {NOM_BASE_DONNEES}")
except ConnectionFailure as exc:
    print(f"[MongoDB] Erreur de connexion: {exc}")
    print("[MongoDB] Le service continuera sans persistance")
    client_mongodb = None
    base_donnees = None
    collection_utilisateurs = None
    collection_citations = None
except PyMongoError as exc:
    print(f"[MongoDB] Erreur d'initialisation: {exc}")
    print("[MongoDB] Le service continuera sans persistance")
    client_mongodb = None
    base_donnees = None
    collection_utilisateurs = None
    collection_citations = None


def obtenir_collection_utilisateurs():
    """Retourne la collection des utilisateurs."""
    return collection_utilisateurs


def obtenir_collection_citations():
    """Retourne la collection des citations sauvegardees."""
    return collection_citations


def obtenir_statut_base_donnees():
    """Retourne un resume de l'etat de la connexion MongoDB."""
    return {
        "connected": base_donnees is not None,
        "database": NOM_BASE_DONNEES,
        "url": masquer_url_mongodb(URL_MONGODB),
    }
