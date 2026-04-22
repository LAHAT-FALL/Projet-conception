"""
Routes pour l'authentification via Google OAuth 2.0.

Ce module implemente le flux d'autorisation OAuth 2.0 avec Google
en deux etapes (deux endpoints HTTP) :

  ETAPE 1 — Initiation : GET /api/auth/google
  ─────────────────────────────────────────────
  Le frontend redirige le navigateur vers cet endpoint.
  Le serveur construit l'URL de consentement Google avec les parametres
  requis (client_id, redirect_uri, scope, etc.) et renvoie une
  redirection HTTP 307 vers accounts.google.com.
  L'utilisateur voit la page de selection de compte Google dans son
  navigateur.

  ETAPE 2 — Callback : GET /api/auth/google/callback?code=...
  ────────────────────────────────────────────────────────────
  Apres que l'utilisateur a accepte (ou refuse) la connexion,
  Google redirige le navigateur vers notre callback avec :
    - code=...  : code d'autorisation a usage unique (expire en ~10 min)
    - error=... : present uniquement si l'utilisateur a refuse l'acces

  Le serveur effectue alors une serie d'operations :
    a) Echange du code contre des tokens (appel HTTP POST serveur→Google)
    b) Recuperation du profil utilisateur avec l'access_token
    c) Creation ou mise a jour du compte dans MongoDB (upsert atomique)
    d) Generation d'un JWT QuoteKeeper identique a une connexion classique
    e) Redirection vers le frontend avec le token dans les parametres d'URL

Pourquoi le code est-il echange cote serveur et non cote client ?
──────────────────────────────────────────────────────────────────
  Le client_secret ne doit JAMAIS transiter par le navigateur.
  L'echange code→token necessite le client_secret, donc il se fait
  exclusivement en communication serveur-a-serveur (backend → Google).
  Le navigateur ne voit que le code d'autorisation (ephemere, a usage unique)
  et le JWT final (valide mais sans pouvoir appeler Google directement).

Schemas de donnees impliques :
  Google profil (GET /oauth2/v3/userinfo) :
    { "sub": "1234...", "email": "user@gmail.com", "name": "Jean Dupont", ... }

  Redirection finale vers le frontend :
    http://localhost:5500?token=JWT&nom=Jean&user_id=...&email=...
"""

import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse

import requests
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from typing import Optional
from pydantic import BaseModel
from pymongo import ReturnDocument

from app.auth import DUREE_EXPIRATION_JETON_MINUTES, creer_jeton_acces, CLE_SECRETE
from app.database import obtenir_collection_utilisateurs
from app.demo_store import upsert_demo_user

# Routeur FastAPI — monte sous le prefixe /api/auth dans main.py
router = APIRouter()

# Schemes autorises pour le parametre state (mobile OAuth redirect)
_SCHEMES_MOBILES_AUTORISES = {"exp", "quotekeeper"}

# Liste blanche des hotes autorises pour les redirections HTTPS mobiles
_HOTES_HTTPS_AUTORISES = {
    "localhost",
    "127.0.0.1",
}


def _state_est_valide(state: str) -> bool:
    """
    Valide que le parametre state contient une URL mobile autorisee.
    Previent les attaques de type open redirect via manipulation du state OAuth.

    Regles :
    - Schemes d'apps mobiles connus (exp://, quotekeeper://) : acceptes sans restriction de domaine
    - Scheme HTTPS : accepte uniquement pour les hotes en liste blanche
    - Tout le reste est refuse
    """
    if not state:
        return False
    try:
        parsed = urlparse(state)
        scheme = parsed.scheme.lower()

        if scheme in _SCHEMES_MOBILES_AUTORISES:
            return bool(parsed.netloc or parsed.path)

        # HTTPS uniquement pour les hotes connus
        if scheme == "https":
            return parsed.netloc in _HOTES_HTTPS_AUTORISES

        return False
    except Exception:
        return False


def _generer_state_csrf() -> str:
    """
    Genere un state CSRF signe par HMAC-SHA256 pour le flux OAuth web.
    Format : <nonce_hex>.<signature_hex>
    Previent les attaques CSRF sur le callback OAuth.
    """
    nonce = secrets.token_hex(16)
    sig = hmac.new(CLE_SECRETE.encode(), nonce.encode(), hashlib.sha256).hexdigest()
    return f"{nonce}.{sig}"


def _state_csrf_valide(state: str) -> bool:
    """
    Verifie la signature HMAC-SHA256 du state CSRF.
    Utilise compare_digest pour eviter les attaques temporelles.
    """
    if not state or "." not in state:
        return False
    nonce, _, sig = state.partition(".")
    if not nonce or not sig:
        return False
    sig_attendue = hmac.new(CLE_SECRETE.encode(), nonce.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, sig_attendue)


class DemandeCodeGoogleMobile(BaseModel):
    """Corps de la requete POST /google/mobile — code d'autorisation + redirect_uri utilise."""
    code: str
    redirect_uri: str

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION OAUTH (chargee depuis les variables d'environnement)
# ─────────────────────────────────────────────────────────────────────────────

# Identifiant public de l'application Google Cloud (visible dans les URLs)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# Secret confidentiel de l'application — ne doit jamais etre expose au frontend
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# URI de redirection web (navigateur desktop)
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

# URI de redirection mobile (le navigateur du telephone doit pouvoir atteindre cette URL)
GOOGLE_REDIRECT_URI_MOBILE = os.getenv("GOOGLE_REDIRECT_URI_MOBILE", GOOGLE_REDIRECT_URI)

# URL du frontend pour les redirections finales apres authentification
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5500")

# ─────────────────────────────────────────────────────────────────────────────
# URLs DES SERVICES GOOGLE (fixes, ne changent pas)
# ─────────────────────────────────────────────────────────────────────────────

# Page de consentement OAuth 2.0 (etape 1 — le navigateur y est redirige)
URL_OAUTH_GOOGLE = "https://accounts.google.com/o/oauth2/v2/auth"

# Endpoint d'echange code→tokens (etape 2a — appel serveur a serveur)
URL_TOKEN_GOOGLE = "https://oauth2.googleapis.com/token"

# Endpoint de profil utilisateur (etape 2b — appel avec l'access_token)
URL_PROFIL_GOOGLE = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google", summary="Redirection vers Google OAuth")
async def connexion_google(mobile_return: Optional[str] = Query(None)):
    """
    Initie le flux OAuth 2.0 en redirigeant vers la page de consentement Google.

    Parametre optionnel :
      - mobile_return : URL vers laquelle rediriger apres auth mobile (passee via state).
                        Si absent, comportement web classique (redirection vers FRONTEND_URL).

    Parametres OAuth construits :
      - client_id       : identifiant de l'application Google
      - redirect_uri    : ou Google doit renvoyer le navigateur apres consentement
      - response_type   : "code" = flux authorization code (le plus securise)
      - scope           : donnees demandees (profil + email + ID stable Google)
      - access_type     : "offline" permet d'obtenir un refresh_token si besoin
      - prompt          : "select_account" force l'affichage du selecteur de compte
      - state           : encode mobile_return pour le retrouver dans le callback
    """
    # Verification que la configuration Google est presente dans .env
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return RedirectResponse(url=f"{FRONTEND_URL}?google_error=non_configure")

    # Construction des parametres de l'URL de consentement Google
    # Utilise l'URI mobile si mobile_return est present, sinon l'URI web
    redirect_uri_actuel = GOOGLE_REDIRECT_URI_MOBILE if mobile_return else GOOGLE_REDIRECT_URI
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri_actuel,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }

    # Encode mobile_return dans le state pour le recuperer dans le callback.
    # Pour le flux web, genere un nonce CSRF signe pour prevenir les attaques CSRF.
    if mobile_return:
        params["state"] = mobile_return
    else:
        params["state"] = _generer_state_csrf()

    # Redirection HTTP 307 vers Google — le navigateur suit automatiquement
    return RedirectResponse(url=f"{URL_OAUTH_GOOGLE}?{urlencode(params)}")


@router.get("/mobile-done", summary="Point d'arret mobile apres OAuth Google")
async def mobile_done():
    """
    Endpoint intercepte par WebBrowser.openAuthSessionAsync sur le mobile.
    Le token est passe en query params par le callback Google.
    """
    return JSONResponse({"status": "ok"})


@router.get("/google/callback", summary="Retour OAuth Google")
async def callback_google(code: str = None, error: str = None, state: str = None):
    """
    Traite le retour de Google apres l'authentification de l'utilisateur.

    Parametres de la requete (transmis par Google dans l'URL) :
      - code  : code d'autorisation a usage unique (present si l'utilisateur a accepte)
      - error : code d'erreur Google (present si l'utilisateur a refuse ou si erreur)

    Flux complet execute par cette fonction :
      1. Verification que le code est present (sinon l'utilisateur a refuse)
      2. Echange du code contre les tokens Google (POST serveur→Google)
      3. Recuperation du profil utilisateur avec l'access_token
      4. Upsert atomique dans MongoDB (cree ou met a jour le compte)
      5. Generation du JWT QuoteKeeper
      6. Redirection vers le frontend avec le token dans l'URL
    """
    # Determine si la requete vient du mobile (state = URL mobile valide)
    est_mobile = _state_est_valide(state)

    # ── 0a. Verification CSRF pour le flux web ────────────────────────────────
    # Pour le flux mobile, le state est l'URL de retour (validee par _state_est_valide).
    # Pour le flux web, le state doit etre un nonce CSRF signe.
    if not est_mobile and not _state_csrf_valide(state):
        print(f"[Google OAuth] State CSRF invalide ou absent")
        return RedirectResponse(url=f"{FRONTEND_URL}?google_error=csrf_invalide")

    # ── 0b. Gestion du refus ou de l'erreur ──────────────────────────────────
    if error or not code:
        print(f"[Google OAuth] Acces refuse ou erreur : {error}")
        cible_erreur = f"{state}?google_error=acces_refuse" if est_mobile else f"{FRONTEND_URL}?google_error=acces_refuse"
        return RedirectResponse(url=cible_erreur)

    # ── 1. Echange du code d'autorisation contre les tokens Google ─────────
    # Appel HTTP POST de serveur a serveur — le navigateur n'est pas implique.
    # Le client_secret est inclus ici (jamais expose au frontend).
    # Le code est a usage unique : une seconde tentative serait refusee par Google.
    # L'URI utilisee dans l'echange doit etre identique a celle du flux initial
    redirect_uri_echange = GOOGLE_REDIRECT_URI_MOBILE if est_mobile else GOOGLE_REDIRECT_URI
    try:
        reponse_token = requests.post(
            URL_TOKEN_GOOGLE,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri_echange,
                "grant_type": "authorization_code",
            },
            timeout=10,  # Timeout de 10 secondes pour eviter de bloquer indefiniment
        )
        # Leve une exception si le status HTTP est une erreur (4xx, 5xx)
        reponse_token.raise_for_status()
        # Contient : access_token, token_type, id_token, refresh_token (si offline)
        tokens = reponse_token.json()
    except Exception as exc:
        print(f"[Google OAuth] Erreur lors de l'echange du code : {exc}")
        return RedirectResponse(url=f"{FRONTEND_URL}?google_error=token_invalide")

    # ── 2. Recuperation du profil utilisateur depuis Google ──────────────────
    # L'access_token permet d'interroger l'API Google pour obtenir les
    # informations de profil : identifiant stable (sub), email, nom complet.
    try:
        reponse_profil = requests.get(
            URL_PROFIL_GOOGLE,
            # L'access_token est transmis dans l'en-tete Authorization (standard OAuth2 Bearer)
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            timeout=10,
        )
        reponse_profil.raise_for_status()
        # Contient : { "sub": "...", "email": "...", "name": "...", "picture": "...", ... }
        profil = reponse_profil.json()
    except Exception as exc:
        print(f"[Google OAuth] Erreur lors de la recuperation du profil : {exc}")
        return RedirectResponse(url=f"{FRONTEND_URL}?google_error=profil_inaccessible")

    # Verifie que l'email a bien ete verifie par Google (flux web)
    if not profil.get("email_verified"):
        print(f"[Google OAuth] Email non verifie par Google")
        return RedirectResponse(url=f"{FRONTEND_URL}?google_error=email_non_verifie")

    # Extraction des champs utiles du profil Google
    # "sub" est l'identifiant stable et unique de l'utilisateur chez Google
    # (contrairement a l'email qui peut changer)
    google_id = profil.get("sub")
    email = profil.get("email", "").strip().lower()
    # Si Google ne fournit pas de nom, on utilise la partie locale de l'email
    nom = profil.get("name", email.split("@")[0])

    # Acces a la collection MongoDB des utilisateurs
    collection_utilisateurs = obtenir_collection_utilisateurs()

    # ── 3a. Mode demo : MongoDB indisponible ──────────────────────────────────
    if collection_utilisateurs is None:
        # Generation d'un identifiant demo base sur l'email (caracteress non-alphanumeriques → _)
        identifiant_demo = f"google_{re.sub(r'[^a-z0-9]', '_', email)}"
        utilisateur = upsert_demo_user(identifiant_demo, nom, email)
        jeton = creer_jeton_acces({"sub": utilisateur["id"], "email": email})
        print(f"[Google OAuth] Connexion demo pour {email}")
        reponse = RedirectResponse(url=f"{FRONTEND_URL}?google_ok=1")
        reponse.set_cookie(
            key="qk_token", value=jeton, httponly=True, samesite="strict",
            max_age=60 * DUREE_EXPIRATION_JETON_MINUTES,
        )
        return reponse

    # ── 3b. Mode normal : upsert atomique dans MongoDB ────────────────────────
    # Recherche par google_id OU par email pour gerer deux cas :
    #   - Premiere connexion Google : aucun compte existant → creation
    #   - Compte existant avec mot de passe → association du google_id
    #   - Reconnexion Google → mise a jour des infos de profil
    #
    # L'operation est ATOMIQUE grace a find_one_and_update + upsert=True :
    # il est impossible de creer deux comptes avec le meme email en parallele.
    maintenant = datetime.now(timezone.utc)
    utilisateur = collection_utilisateurs.find_one_and_update(
        # Filtre : trouve le document correspondant a ce google_id OU cet email
        {"$or": [{"google_id": google_id}, {"email": email}]},
        {
            # $set : met a jour ces champs a chaque connexion Google
            "$set": {
                "nom": nom,                      # Le nom peut changer dans Google
                "email": email,                  # Normalisation email
                "google_id": google_id,          # Lie le compte a l'identifiant Google stable
                "modifie_le": maintenant,        # Horodatage de la derniere modification
            },
            # $setOnInsert : ces champs ne sont definis QUE lors de la creation
            # (pas lors d'une mise a jour d'un compte existant)
            "$setOnInsert": {
                "mot_de_passe_hash": None,   # Pas de mot de passe pour les comptes Google
                "favorites": [],             # Liste vide au depart
                "favorite_quotes": {},       # Dictionnaire vide au depart
                "cree_le": maintenant,       # Date de creation du compte
            },
        },
        upsert=True,                         # Cree le document s'il n'existe pas
        return_document=ReturnDocument.AFTER, # Retourne le document APRES modification
    )

    # Extraction de l'identifiant MongoDB genere automatiquement
    user_id = str(utilisateur["_id"])

    # Generation du JWT QuoteKeeper (meme format que la connexion classique)
    jeton = creer_jeton_acces({"sub": user_id, "email": email})

    print(f"[Google OAuth] Connexion reussie pour {email}")

    # ── 4. Redirection finale ────────────────────────────────────────────────
    # Mobile : token dans query string (?token=...) — intercepte par WebBrowser
    # Web    : cookie httpOnly defini, redirection vers ?google_ok=1 (pas de token en URL)
    if est_mobile and state:
        return RedirectResponse(url=f"{state}?token={jeton}")
    reponse = RedirectResponse(url=f"{FRONTEND_URL}?google_ok=1")
    reponse.set_cookie(
        key="qk_token", value=jeton, httponly=True, samesite="strict",
        max_age=60 * DUREE_EXPIRATION_JETON_MINUTES,
    )
    return reponse


@router.post("/google/mobile", summary="Connexion Google pour mobile (authorization code)")
async def connexion_google_mobile(corps: DemandeCodeGoogleMobile):
    """
    Authentifie un utilisateur mobile via un code d'autorisation Google (expo-auth-session).

    Flux :
      1. L'app mobile obtient un code d'autorisation Google via expo-auth-session
      2. Le code + redirect_uri sont envoyes a cet endpoint (POST JSON)
      3. Le serveur echange le code contre des tokens (necessite le client_secret)
      4. Le serveur cree ou met a jour le compte dans MongoDB (upsert atomique)
      5. Retourne { access_token, user } — meme format que POST /login

    Le client_secret reste confidentiel cote serveur — il n'est jamais expose au mobile.
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google OAuth non configure sur ce serveur")

    # ── 1. Echange du code contre des tokens Google ───────────────────────────
    try:
        reponse_token = requests.post(
            URL_TOKEN_GOOGLE,
            data={
                "code": corps.code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": corps.redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        reponse_token.raise_for_status()
        tokens = reponse_token.json()
    except Exception as exc:
        print(f"[Google Mobile] Erreur echange code : {exc}")
        raise HTTPException(status_code=401, detail="Code Google invalide ou expire")

    # ── 2. Verification locale du ID token via les cles publiques Google ────────
    # google-auth telecharge et met en cache les cles JWKS de Google, verifie la
    # signature RSA, l'expiration et l'audience (aud == GOOGLE_CLIENT_ID).
    # Plus securise et plus rapide que l'endpoint tokeninfo (appel reseau redondant).
    id_token = tokens.get("id_token")
    if not id_token:
        raise HTTPException(status_code=401, detail="Token Google invalide (id_token absent)")

    try:
        _req = google_requests.Request()
        info = google_id_token.verify_oauth2_token(id_token, _req, GOOGLE_CLIENT_ID)
    except ValueError as exc:
        print(f"[Google Mobile] Token invalide : {exc}")
        raise HTTPException(status_code=401, detail="Token Google invalide")

    # Verifie que l'email a bien ete verifie par Google
    if not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Email Google non verifie")

    # ── 3. Extraction du profil Google ───────────────────────────────────────
    google_id = info.get("sub")
    email = info.get("email", "").strip().lower()
    nom = info.get("name", email.split("@")[0])

    collection_utilisateurs = obtenir_collection_utilisateurs()

    # ── 4a. Mode demo si MongoDB indisponible ─────────────────────────────────
    if collection_utilisateurs is None:
        identifiant_demo = f"google_{re.sub(r'[^a-z0-9]', '_', email)}"
        utilisateur = upsert_demo_user(identifiant_demo, nom, email)
        jeton = creer_jeton_acces({"sub": utilisateur["id"], "email": email})
        return {"access_token": jeton, "user": {"id": utilisateur["id"], "nom": nom, "email": email}}

    # ── 4b. Upsert atomique dans MongoDB (meme logique que le callback web) ──
    maintenant = datetime.now(timezone.utc)
    utilisateur = collection_utilisateurs.find_one_and_update(
        {"$or": [{"google_id": google_id}, {"email": email}]},
        {
            "$set": {
                "nom": nom,
                "email": email,
                "google_id": google_id,
                "modifie_le": maintenant,
            },
            "$setOnInsert": {
                "mot_de_passe_hash": None,  # Pas de mot de passe pour les comptes Google
                "favorites": [],
                "favorite_quotes": {},
                "cree_le": maintenant,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    user_id = str(utilisateur["_id"])
    jeton = creer_jeton_acces({"sub": user_id, "email": email})

    print(f"[Google Mobile] Connexion reussie pour {email}")

    # Meme structure de reponse que POST /login
    return {"access_token": jeton, "user": {"id": user_id, "nom": nom, "email": email}}
