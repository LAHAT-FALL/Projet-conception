"""
Point d'entree principal de l'API QuoteKeeper.
"""

import os
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException as StarletteHTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth import verifier_jeton
from app.database import obtenir_statut_base_donnees
from app.routes import auth_routes, google_routes, quotes_routes
from app.routes.quotes_routes import seeder_citations_secours

load_dotenv()

application = FastAPI(
    title="QuoteKeeper API",
    description="""
    API pour gerer des citations favorites.

    Fonctionnalites :
    - authentification email/mot de passe et Google OAuth 2.0
    - recuperation de citations aleatoires (API Ninjas)
    - traduction de citations en francais (MyMemory)
    - gestion des favoris avec persistance MongoDB
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
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]

application.add_middleware(
    CORSMiddleware,
    allow_origins=origines_autorisees,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

application.include_router(auth_routes.router, prefix="/api/auth", tags=["Authentification"])
application.include_router(google_routes.router, prefix="/api/auth", tags=["Authentification Google"])
application.include_router(quotes_routes.router, prefix="/api/quotes", tags=["Citations"])


@application.on_event("startup")
async def au_demarrage():
    """Initialise les donnees de base au demarrage du serveur."""
    seeder_citations_secours()


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
                "logout": "POST /api/auth/logout",
                "google": "GET /api/auth/google",
                "google_callback": "GET /api/auth/google/callback",
                "verify": "GET /api/auth/verify",
                "profile": "GET /api/auth/profile",
                "profile_update": "PUT /api/auth/profile",
                "password_change": "PUT /api/auth/profile/password",
            },
            "quotes": {
                "random": "GET /api/quotes/random?category=X&author=Y",
                "daily": "GET /api/quotes/daily",
                "translate": "GET /api/quotes/translate",
                "favorites": "GET /api/quotes/favorites",
                "add_favorite": "POST /api/quotes/favorites/{id}",
                "note_favorite": "PATCH /api/quotes/favorites/{id}/note",
                "remove_favorite": "DELETE /api/quotes/favorites/{id}",
            },
        },
        "auteur": "Equipe de conception - Hiver 2026",
    }


@application.get("/api/auth/verify", tags=["Authentification"])
async def verifier_token(request: Request):
    """
    Verifie si le token JWT fourni en header Authorization est encore valide.

    Utilise par le frontend au chargement de la page pour eviter de restaurer
    une session avec un token expire. Retourne 401 si invalide.
    """
    authorisation = request.headers.get("Authorization", "")
    morceaux = authorisation.split()

    if len(morceaux) != 2 or morceaux[0].lower() != "bearer":
        return JSONResponse(
            status_code=401,
            content={"valid": False, "detail": "Token manquant ou mal forme"},
        )

    identifiant = verifier_jeton(morceaux[1])

    if not identifiant:
        return JSONResponse(
            status_code=401,
            content={"valid": False, "detail": "Token invalide ou expire"},
        )

    return {"valid": True, "user_id": identifiant}


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


@application.exception_handler(RequestValidationError)
async def gestionnaire_erreur_validation(request: Request, exc: RequestValidationError):
    """Retourne les details de validation Pydantic pour faciliter le debogage."""
    errors = [
        {"loc": e["loc"], "msg": e["msg"], "type": e["type"], "input": str(e.get("input", ""))}
        for e in exc.errors()
    ]
    print(f"[VALIDATION 422] body={exc.body!r} errors={errors}")
    return JSONResponse(
        status_code=422,
        content={"status": "error", "code": 422, "detail": errors},
    )


@application.exception_handler(StarletteHTTPException)
async def gestionnaire_erreur_http(request: Request, exc: StarletteHTTPException):
    """Retourne une reponse JSON uniforme pour toutes les erreurs HTTP."""
    messages = {
        400: "Requete invalide",
        401: "Authentification requise",
        403: "Acces refuse",
        404: "Ressource introuvable",
        405: "Methode non autorisee",
        422: "Donnees invalides",
        500: "Erreur interne du serveur",
    }
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "code": exc.status_code,
            "message": messages.get(exc.status_code, "Erreur inconnue"),
            "detail": exc.detail,
            "path": request.url.path,
        },
    )


@application.exception_handler(Exception)
async def gestionnaire_exception_globale(request: Request, exc: Exception):
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
