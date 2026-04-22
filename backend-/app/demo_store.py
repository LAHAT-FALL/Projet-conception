"""
Stockage en memoire pour le mode demonstration.

Ce module remplace MongoDB quand celui-ci est indisponible.
Il fournit un dictionnaire en memoire qui simule la persistance des utilisateurs
et de leurs citations favorites.

Limitations :
- Les donnees sont perdues a chaque redemarrage du serveur
- Ne supporte pas plusieurs instances du serveur en parallele
- Reserve au developpement et aux demonstrations
"""

from copy import deepcopy

# Dictionnaire principal simulant la collection "users" de MongoDB.
# Cle : identifiant unique de l'utilisateur
# Valeur : document utilisateur complet
DEMO_USERS = {
    "demo_123": {
        "id": "demo_123",
        "nom": "Utilisateur Demo",
        "email": "demo@test.com",
        "favorites": [],           # Liste des IDs de citations favorites
        "favorite_quotes": {},     # Dictionnaire id -> details complets de la citation
    }
}


def get_demo_user_by_email(email: str):
    """
    Recherche un utilisateur demo par son adresse email.

    Retourne une copie profonde (deepcopy) pour eviter les modifications
    accidentelles du dictionnaire global DEMO_USERS.
    Retourne None si aucun utilisateur ne correspond.
    """
    for user in DEMO_USERS.values():
        if user["email"] == email:
            return deepcopy(user)
    return None


def get_demo_user_by_id(user_id: str):
    """
    Recherche un utilisateur demo par son identifiant unique.

    Retourne une copie profonde ou None si l'identifiant n'existe pas.
    """
    user = DEMO_USERS.get(user_id)
    return deepcopy(user) if user else None


def upsert_demo_user(user_id: str, nom: str, email: str):
    """
    Cree ou met a jour un utilisateur dans le stockage demo.

    Si l'utilisateur existe deja (reconnexion), ses favoris sont conserves.
    Si l'utilisateur est nouveau, un profil vide est cree.

    Simule le comportement d'un upsert MongoDB (update or insert).
    """
    # Recuperation du profil existant pour conserver les favoris
    existing = DEMO_USERS.get(user_id, {})

    DEMO_USERS[user_id] = {
        "id": user_id,
        "nom": nom,
        "email": email,
        # Conservation des favoris existants ou liste vide si nouveau
        "favorites": existing.get("favorites", []),
        "favorite_quotes": existing.get("favorite_quotes", {}),
    }

    return deepcopy(DEMO_USERS[user_id])


def add_demo_favorite(user_id: str, quote: dict):
    """
    Ajoute une citation aux favoris d'un utilisateur demo.

    Si l'utilisateur n'existe pas encore, un profil temporaire est cree.
    Si la citation est deja dans les favoris, elle n'est pas ajoutee en double.
    Le detail complet de la citation est conserve pour l'affichage ulterieur.
    """
    # setdefault cree l'utilisateur s'il n'existe pas encore
    user = DEMO_USERS.setdefault(
        user_id,
        {
            "id": user_id,
            "nom": "Utilisateur Demo",
            "email": f"{user_id}@demo.local",
            "favorites": [],
            "favorite_quotes": {},
        },
    )

    quote_id = quote["id"]

    # Ajout de l'ID dans la liste si absent (evite les doublons)
    if quote_id not in user["favorites"]:
        user["favorites"].append(quote_id)

    # Sauvegarde du detail complet pour pouvoir afficher la citation
    # sans avoir besoin d'une requete supplementaire vers MongoDB
    user["favorite_quotes"][quote_id] = deepcopy(quote)

    return deepcopy(user)


def remove_demo_favorite(user_id: str, quote_id: str):
    """
    Retire une citation des favoris d'un utilisateur demo.

    Supprime l'ID de la liste favorites et le detail dans favorite_quotes.
    Retourne None si l'utilisateur est introuvable.
    """
    user = DEMO_USERS.get(user_id)
    if not user:
        return None

    # Suppression de l'ID dans la liste (sans erreur si absent)
    if quote_id in user["favorites"]:
        user["favorites"].remove(quote_id)

    # Suppression du detail complet (pop sans erreur si absent)
    user["favorite_quotes"].pop(quote_id, None)

    return deepcopy(user)


def update_demo_favorite_note(user_id: str, quote_id: str, note: str):
    """
    Ajoute ou modifie la note personnelle sur un favori en mode demo.

    Retourne le profil mis a jour, ou None si l'utilisateur ou la citation
    est introuvable dans le stockage demo.
    """
    user = DEMO_USERS.get(user_id)
    if not user:
        return None

    # Verification que la citation est bien dans les favoris de l'utilisateur
    if quote_id not in user.get("favorite_quotes", {}):
        return None

    # Ajout ou remplacement de la note sur la citation
    user["favorite_quotes"][quote_id]["note"] = note
    return deepcopy(user)


def update_demo_favorite_tag(user_id: str, quote_id: str, tag: str):
    """
    Ajoute ou modifie le tag personnalise sur un favori en mode demo.

    Retourne le profil mis a jour, ou None si l'utilisateur ou la citation
    est introuvable dans le stockage demo.
    """
    user = DEMO_USERS.get(user_id)
    if not user:
        return None

    if quote_id not in user.get("favorite_quotes", {}):
        return None

    user["favorite_quotes"][quote_id]["tag"] = tag
    return deepcopy(user)


def update_demo_user_profile(user_id: str, nom: str):
    """
    Met a jour le nom d'affichage d'un utilisateur demo.

    Retourne le profil mis a jour, ou None si l'utilisateur est introuvable.
    """
    user = DEMO_USERS.get(user_id)
    if not user:
        return None

    user["nom"] = nom
    return deepcopy(user)
