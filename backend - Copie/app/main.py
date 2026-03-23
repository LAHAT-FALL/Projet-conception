"""
Point d'entree principal de l'API QuoteKeeper.
"""

import os
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import obtenir_statut_base_donnees
from app.routes import auth_routes, quotes_routes

load_dotenv()

application = FastAPI(
    title="QuoteKeeper API",
    description="""
    API pour gerer des citations favorites.

    Fonctionnalites :
    - authentification des utilisateurs
    - recuperation de citations aleatoires
    - gestion des favoris
    """,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    contact={
        "name": "Equipe de conception",
        "email": "equipe@example.com",
    },
)

origines_autorisees = [
    "http://localhost",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5501",
    "http://127.0.0.1:5501",
]

application.add_middleware(
    CORSMiddleware,
    allow_origins=origines_autorisees,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

application.include_router(auth_routes.router, prefix="/api/auth", tags=["Authentification"])
application.include_router(quotes_routes.router, prefix="/api/quotes", tags=["Citations"])


@application.get("/", tags=["Accueil"])
async def accueil():
    """Retourne un apercu rapide de l'API."""
    return {
        "service": "QuoteKeeper API",
        "version": "1.0.0",
        "status": "operationnel",
        "documentation": {
            "swagger": "/api/docs",
            "redoc": "/api/redoc",
        },
        "endpoints": {
            "auth": {
                "register": "POST /api/auth/register",
                "login": "POST /api/auth/login",
            },
            "quotes": {
                "random": "GET /api/quotes/random",
                "favorites": "GET /api/quotes/favorites",
                "add_favorite": "POST /api/quotes/favorites/{id}",
                "remove_favorite": "DELETE /api/quotes/favorites/{id}",
            },
        },
        "auteur": "Equipe de conception - Hiver 2026",
    }


@application.get("/api/health", tags=["Sante"])
async def verification_sante():
    """Retourne l'etat courant du service et de la connexion MongoDB."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": obtenir_statut_base_donnees(),
        "api_key_configured": bool(os.getenv("NINJAS_API_KEY")),
    }


@application.get("/api/config", tags=["Configuration"])
async def lire_configuration():
    """Retourne une vue non sensible de la configuration du backend."""
    return {
        "database": obtenir_statut_base_donnees(),
        "cors_origins": origines_autorisees,
        "jwt_algorithm": os.getenv("ALGORITHM", "HS256"),
        "token_expiry": f"{os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '30')} minutes",
        "ninjas_api": "configure" if os.getenv("NINJAS_API_KEY") else "fallback local actif",
    }


@application.exception_handler(Exception)
async def gestionnaire_exception_globale(request, exc):
    """Retourne une reponse JSON standard en cas d'erreur non geree."""
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "code": 500,
            "message": "Une erreur interne est survenue",
            "detail": str(exc),
            "path": request.url.path,
        },
    )


app = application
