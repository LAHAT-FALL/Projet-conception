"""
Gestion de la connexion MongoDB pour QuoteKeeper.

Ce module etablit la connexion a la base de donnees au demarrage du serveur
et expose des fonctions pour acceder aux collections.

Si la connexion echoue (MongoDB absent ou non autorise), toutes les collections
restent a None et le service bascule automatiquement en mode demonstration.
"""

import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError

# Chargement des variables d'environnement depuis le fichier .env
load_dotenv()

# URL de connexion MongoDB (inclut les identifiants si l'auth est activee)
URL_MONGODB = os.getenv("MONGODB_URL", "mongodb://localhost:27017")

# Nom de la base de donnees utilisee par QuoteKeeper
NOM_BASE_DONNEES = os.getenv("MONGODB_DB_NAME", "quote_keeper")

print(f"[MongoDB] Tentative de connexion a {URL_MONGODB}")

# Variables globales de connexion — initialisees a None par securite
client_mongodb = None
base_donnees = None
collection_utilisateurs = None
collection_citations = None


def masquer_url_mongodb(url: str) -> str:
    """
    Masque le mot de passe eventuel d'une URL MongoDB avant affichage dans les logs.

    Exemple : mongodb://user:motdepasse@localhost:27017 → mongodb://user:***@localhost:27017
    Evite de divulguer des informations sensibles dans les journaux du serveur.
    """
    if "@" not in url or "://" not in url:
        return url

    scheme, reste = url.split("://", 1)
    identifiants, suffixe = reste.split("@", 1)

    if ":" not in identifiants:
        return f"{scheme}://***@{suffixe}"

    nom_utilisateur, _ = identifiants.split(":", 1)
    return f"{scheme}://{nom_utilisateur}:***@{suffixe}"


def initialiser_index():
    """
    Cree les index MongoDB pour optimiser les requetes frequentes.

    Index crees :
    - users.email        : unique, pour eviter les doublons et accelerer la connexion
    - quotes.id          : unique, pour les lookups par identifiant de citation
    - quotes.(author, category) : index compose pour les futures recherches par auteur/categorie
    """
    if collection_utilisateurs is None or collection_citations is None:
        return

    # Index unique sur l'email — garantit qu'un email ne peut etre utilise qu'une fois
    collection_utilisateurs.create_index("email", unique=True)

    # Index unique sur l'identifiant stable de citation
    collection_citations.create_index("id", unique=True)

    # Index compose pour les recherches futures par auteur et categorie
    collection_citations.create_index([("author", 1), ("category", 1)])


# Bloc de connexion execute une seule fois au chargement du module
try:
    # Connexion avec timeout de 5 secondes pour ne pas bloquer le demarrage
    client_mongodb = MongoClient(URL_MONGODB, serverSelectionTimeoutMS=5000)

    # Ping pour verifier que le serveur repond reellement
    client_mongodb.admin.command("ping")

    # Acces a la base de donnees et aux collections
    base_donnees = client_mongodb[NOM_BASE_DONNEES]
    collection_utilisateurs = base_donnees["users"]
    collection_citations = base_donnees["quotes"]

    # Creation des index si necessaire
    initialiser_index()

    print("[MongoDB] Connexion etablie avec succes")
    print(f"[MongoDB] Base de donnees active: {NOM_BASE_DONNEES}")

except ConnectionFailure as exc:
    # MongoDB inaccessible (serveur eteint, mauvaise URL, etc.)
    print(f"[MongoDB] Erreur de connexion: {exc}")
    print("[MongoDB] Le service continuera sans persistance")
    client_mongodb = None
    base_donnees = None
    collection_utilisateurs = None
    collection_citations = None

except PyMongoError as exc:
    # Erreur MongoDB generique (authentification, permissions, etc.)
    print(f"[MongoDB] Erreur d'initialisation: {exc}")
    print("[MongoDB] Le service continuera sans persistance")
    client_mongodb = None
    base_donnees = None
    collection_utilisateurs = None
    collection_citations = None


def obtenir_collection_utilisateurs():
    """
    Retourne la collection MongoDB des utilisateurs.

    Retourne None si MongoDB est indisponible — le code appelant
    doit verifier cette valeur et basculer en mode demo si necessaire.
    """
    return collection_utilisateurs


def obtenir_collection_citations():
    """
    Retourne la collection MongoDB des citations sauvegardees.

    Retourne None si MongoDB est indisponible.
    """
    return collection_citations


def obtenir_statut_base_donnees():
    """
    Retourne un resume de l'etat de la connexion MongoDB.

    Utilise par les endpoints /api/health et /api/config
    pour exposer l'etat du systeme sans divulguer les identifiants.
    """
    return {
        "connected": base_donnees is not None,
        "database": NOM_BASE_DONNEES,
        "url": masquer_url_mongodb(URL_MONGODB),
    }
