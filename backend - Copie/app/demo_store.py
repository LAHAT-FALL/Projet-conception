"""
Stockage en memoire pour le mode demonstration.

Ce module est utilise uniquement lorsque MongoDB n'est pas disponible.
Les donnees sont perdues au redemarrage du serveur.
"""

from copy import deepcopy

# Utilisateur de demonstration fourni par defaut.
DEMO_USERS = {
    "demo_123": {
        "id": "demo_123",
        "nom": "Utilisateur Demo",
        "email": "demo@test.com",
        "favorites": [],
        "favorite_quotes": {},
    }
}


def get_demo_user_by_email(email: str):
    """Retourne une copie d'un utilisateur demo a partir de son email."""
    for user in DEMO_USERS.values():
        if user["email"] == email:
            return deepcopy(user)
    return None


def get_demo_user_by_id(user_id: str):
    """Retourne une copie d'un utilisateur demo a partir de son identifiant."""
    user = DEMO_USERS.get(user_id)
    return deepcopy(user) if user else None


def upsert_demo_user(user_id: str, nom: str, email: str):
    """
    Cree ou met a jour un utilisateur demo.

    La liste de favoris existante est conservee si l'utilisateur existe deja.
    """
    existing = DEMO_USERS.get(user_id, {})
    DEMO_USERS[user_id] = {
        "id": user_id,
        "nom": nom,
        "email": email,
        "favorites": existing.get("favorites", []),
        "favorite_quotes": existing.get("favorite_quotes", {}),
    }
    return deepcopy(DEMO_USERS[user_id])


def add_demo_favorite(user_id: str, quote: dict):
    """Ajoute une citation aux favoris d'un utilisateur demo."""
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
    if quote_id not in user["favorites"]:
        user["favorites"].append(quote_id)

    # On conserve aussi le detail complet de la citation
    # pour pouvoir l'afficher sans base MongoDB.
    user["favorite_quotes"][quote_id] = deepcopy(quote)
    return deepcopy(user)


def remove_demo_favorite(user_id: str, quote_id: str):
    """Retire une citation des favoris d'un utilisateur demo."""
    user = DEMO_USERS.get(user_id)
    if not user:
        return None

    if quote_id in user["favorites"]:
        user["favorites"].remove(quote_id)

    user["favorite_quotes"].pop(quote_id, None)
    return deepcopy(user)
