"""
Point d'entree principal de l'API QuoteKeeper.
"""

import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv

# load_dotenv() DOIT etre appele avant d'importer les modules internes
# car ils lisent les variables d'environnement au niveau module (SECRET_KEY, etc.)
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import HTMLResponse, JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.database import obtenir_statut_base_donnees
from app.routes import ai_routes, auth_routes, google_routes, otp_routes, quotes_routes

# ─────────────────────────────────────────────────────────────────────────────
# RATE LIMITER GLOBAL
# ─────────────────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ─────────────────────────────────────────────────────────────────────────────
# MODE PRODUCTION vs DEVELOPPEMENT
# ─────────────────────────────────────────────────────────────────────────────
ENV = os.getenv("ENV", "development")
est_production = ENV == "production"

# Les docs Swagger ne sont accessibles qu'en developpement
_docs_url = None if est_production else "/api/docs"
# ReDoc est gere par une route manuelle pour epingler la version JS (0.104.1 ignore redoc_js_url)
_redoc_url = None  # desactive la route built-in dans tous les cas
_REDOC_JS = "https://cdn.jsdelivr.net/npm/redoc@2.1.3/bundles/redoc.standalone.js"


_CSP_DOCS = (
    # CSP permissive pour les pages de documentation (Swagger UI et ReDoc).
    # Uniquement accessible en developpement (docs desactivees en production).
    "default-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com "
    "https://fonts.gstatic.com https://fastapi.tiangolo.com; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; "
    "img-src 'self' data: https:; "
    "connect-src 'self' blob: https://cdn.jsdelivr.net; "
    "worker-src blob:; "
    "child-src blob:; "
    "frame-ancestors 'none';"
)

_CSP_API = (
    # CSP stricte pour tous les autres endpoints.
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: https:; "
    "connect-src 'self' https://accounts.google.com; "
    "frame-ancestors 'none';"
)

_CHEMINS_DOCS = {"/api/docs", "/api/redoc", "/openapi.json"}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Ajoute les headers de securite HTTP a toutes les reponses."""

    async def dispatch(self, request: Request, call_next):
        reponse = await call_next(request)
        # Empeche le MIME sniffing
        reponse.headers["X-Content-Type-Options"] = "nosniff"
        # Bloque le chargement dans des iframes (clickjacking)
        reponse.headers["X-Frame-Options"] = "DENY"
        # Protection XSS legacy (navigateurs anciens)
        reponse.headers["X-XSS-Protection"] = "1; mode=block"
        # Limite l'information envoyee dans le header Referer
        reponse.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Force HTTPS pendant 1 an, y compris les sous-domaines
        reponse.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # CSP adaptee : permissive pour les pages de doc, stricte pour l'API
        csp = _CSP_DOCS if request.url.path in _CHEMINS_DOCS else _CSP_API
        reponse.headers["Content-Security-Policy"] = csp
        # Desactive les fonctionnalites sensibles du navigateur
        reponse.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=()"
        )
        return reponse


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Ajoute un identifiant unique a chaque requete pour l'audit et le debug."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        reponse = await call_next(request)
        reponse.headers["X-Request-ID"] = request_id
        return reponse


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
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    contact={
        "name": "Equipe de conception",
        "email": "equipe@example.com",
    },
)

# ─────────────────────────────────────────────────────────────────────────────
# RATE LIMITING
# ─────────────────────────────────────────────────────────────────────────────
application.state.limiter = limiter
application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
application.add_middleware(SlowAPIMiddleware)

# ─────────────────────────────────────────────────────────────────────────────
# HEADERS DE SECURITE & REQUEST ID
# ─────────────────────────────────────────────────────────────────────────────
application.add_middleware(SecurityHeadersMiddleware)
application.add_middleware(RequestIdMiddleware)

# ─────────────────────────────────────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────────────────────────────────────
# Origines lues depuis CORS_ORIGINS (virgule-separees).
# En production : ne lister que les domaines reels, pas localhost.
_cors_env = os.getenv("CORS_ORIGINS", "https://localhost:5500,https://127.0.0.1:5500")
origines_autorisees = [o.strip() for o in _cors_env.split(",") if o.strip()]

application.add_middleware(
    CORSMiddleware,
    allow_origins=origines_autorisees,
    allow_credentials=True,
    # Methodes explicites — jamais "*" avec allow_credentials=True
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    # Headers explicites — jamais "*" avec allow_credentials=True
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

# ─────────────────────────────────────────────────────────────────────────────
# ROUTEURS
# ─────────────────────────────────────────────────────────────────────────────
application.include_router(auth_routes.router, prefix="/api/auth", tags=["Authentification"])
application.include_router(google_routes.router, prefix="/api/auth", tags=["Authentification Google"])
application.include_router(otp_routes.router, prefix="/api/auth", tags=["Authentification OTP"])
application.include_router(quotes_routes.router, prefix="/api/quotes", tags=["Citations"])
application.include_router(ai_routes.router, prefix="/api/ai", tags=["IA"])


if not est_production:
    @application.get("/api/redoc", include_in_schema=False, tags=["Documentation"])
    async def redoc_personnalise(request: Request) -> HTMLResponse:
        """ReDoc avec version JS epinglee (FastAPI 0.104.1 ignore redoc_js_url dans le constructeur)."""
        root_path = request.scope.get("root_path", "").rstrip("/")
        return get_redoc_html(
            openapi_url=root_path + "/openapi.json",
            title="QuoteKeeper API - ReDoc",
            redoc_js_url=_REDOC_JS,
        )


@application.get("/", tags=["Accueil"])
async def accueil():
    """Retourne un apercu rapide de l'API."""
    return {
        "service": "QuoteKeeper API",
        "version": "1.0.0",
        "status": "operationnel",
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
    Verifie si le token JWT (Bearer header ou cookie qk_token) est encore valide.
    Retourne 401 si invalide.
    """
    from app.auth import verifier_jeton as _verifier

    # Priorite : Bearer header, puis cookie
    token = None
    authorisation = request.headers.get("Authorization", "")
    morceaux = authorisation.split()
    if len(morceaux) == 2 and morceaux[0].lower() == "bearer":
        token = morceaux[1]
    else:
        token = request.cookies.get("qk_token")

    if not token:
        return JSONResponse(
            status_code=401,
            content={"valid": False, "detail": "Token manquant"},
        )

    identifiant = _verifier(token)
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
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": obtenir_statut_base_donnees(),
        "api_key_configured": bool(os.getenv("NINJAS_API_KEY")),
    }


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
        429: "Trop de requetes — veuillez patienter",
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
    """Retourne une reponse JSON standard en cas d'erreur non geree.
    Le detail interne n'est jamais expose au client pour eviter la fuite d'information.
    """
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "code": 500,
            "message": "Une erreur interne est survenue",
            "path": request.url.path,
        },
    )


app = application
