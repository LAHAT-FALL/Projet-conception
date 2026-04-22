"""
Dependances FastAPI partagees entre les modules de routes.
"""

from typing import Optional

from fastapi import Cookie, Header, HTTPException, status

from app.auth import verifier_jeton


async def obtenir_utilisateur_courant(
    authorization: Optional[str] = Header(None),
    qk_token: Optional[str] = Cookie(None),
) -> str:
    """
    Extrait et valide le token JWT depuis le header Authorization ou le cookie httpOnly.

    Priorite :
      1. Header  Authorization: Bearer <token>  (clients mobile / API)
      2. Cookie  qk_token                        (clients web)

    Retourne l'identifiant utilisateur (sub) si le token est valide.
    Leve HTTP 401 dans tous les autres cas (absent, mal forme, expire).
    """
    token = None

    if authorization:
        morceaux = authorization.split()
        if len(morceaux) != 2 or morceaux[0].lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Format de token invalide. Utilisez 'Bearer <token>'",
            )
        token = morceaux[1]
    elif qk_token:
        token = qk_token
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token d'authentification manquant",
            headers={"WWW-Authenticate": "Bearer"},
        )

    identifiant = verifier_jeton(token)
    if not identifiant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expire",
        )

    return identifiant
