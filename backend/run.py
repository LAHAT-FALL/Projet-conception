#!/usr/bin/env python
"""
Script de lancement du serveur FastAPI pour QuoteKeeper.

Utilisation :
    python run.py

Pre-requis : certificat mkcert dans backend/certs/cert.pem et key.pem
    mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1
"""

import asyncio
import logging
import os
import subprocess
import sys
import threading
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

# Ajoute le dossier backend au PYTHONPATH afin de pouvoir importer app.main.
sys.path.insert(0, str(Path(__file__).parent))

# Charge explicitement le fichier .env du backend avant de lire la configuration.
load_dotenv(Path(__file__).parent / ".env")


if __name__ == "__main__":
    print("=" * 50)
    print("Demarrage du service QuoteKeeper API")
    print("=" * 50)
    print()

    # Verification rapide des dependances critiques avant le lancement.
    try:
        import fastapi   # noqa: F401
        import pymongo   # noqa: F401
        import requests  # noqa: F401
        print("Dependances backend detectees correctement")
    except ImportError as exc:
        print(f"Dependance manquante : {exc}")
        print("Executez : pip install -r requirements.txt")
        sys.exit(1)

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload_enabled = os.getenv("RELOAD", "False").lower() == "true"

    # Verification du certificat mkcert
    certs_dir = Path(__file__).parent / "certs"
    cert_path = certs_dir / "cert.pem"
    key_path  = certs_dir / "key.pem"

    if not cert_path.exists() or not key_path.exists():
        print("ERREUR : Certificat TLS introuvable.")
        print("Generez-le avec mkcert :")
        print("  mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1")
        sys.exit(1)

    print("Configuration du serveur :")
    print(f"  - Hote : {host}")
    print(f"  - Port : {port}")
    print(f"  - Rechargement automatique : {reload_enabled}")
    print(f"  - TLS  : {cert_path}")
    print()

    print("Documentation du projet :")
    print(f"  - Swagger UI : https://localhost:{port}/api/docs")
    print(f"  - ReDoc      : https://localhost:{port}/api/redoc")
    print()

    print("Points d'entree utiles :")
    print(f"  - Accueil : https://localhost:{port}/")
    print(f"  - Sante   : https://localhost:{port}/api/health")
    print()

    # Lancement du frontend HTTPS en arriere-plan
    frontend_dir = Path(__file__).parent.parent / "frontend"
    frontend_proc = subprocess.Popen(
        [
            sys.executable,
            str(Path(__file__).parent / "https_frontend.py"),
            str(frontend_dir),
            "5500",
            str(cert_path),
            str(key_path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"Frontend demarre sur https://localhost:5500 (PID {frontend_proc.pid})")
    print("-" * 50)

    # Supprime le WinError 10054 (ConnectionResetError) genere par asyncio/SSL sur Windows.
    # Le navigateur ferme la connexion SSL avant que le serveur ait termine — sans consequence.
    if sys.platform == "win32":
        def _ignorer_connexion_reset(loop, ctx):
            if isinstance(ctx.get("exception"), ConnectionResetError):
                return
            loop.default_exception_handler(ctx)

        loop = asyncio.new_event_loop()
        loop.set_exception_handler(_ignorer_connexion_reset)
        asyncio.set_event_loop(loop)
        logging.getLogger("asyncio").setLevel(logging.CRITICAL)

    # Serveur HTTP sur port 8001 pour le mobile (pas de certificat requis)
    port_mobile = port + 1
    def _run_http_mobile():
        uvicorn.run("app.main:app", host=host, port=port_mobile, log_level="warning")

    mobile_thread = threading.Thread(target=_run_http_mobile, daemon=True)
    mobile_thread.start()
    print(f"Serveur mobile (HTTP) demarre sur http://0.0.0.0:{port_mobile}")
    print(f"  -> Configurez mobile/.env : EXPO_PUBLIC_API_URL=http://<IP_LAN>:{port_mobile}/api")
    print("-" * 50)

    try:
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=reload_enabled,
            log_level="info",
            ssl_certfile=str(cert_path),
            ssl_keyfile=str(key_path),
        )
    finally:
        frontend_proc.terminate()
