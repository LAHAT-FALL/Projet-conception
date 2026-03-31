#!/usr/bin/env python
"""
Script de lancement du serveur FastAPI pour QuoteKeeper.

Utilisation :
    python run.py
"""

import os
import subprocess
import sys
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
        import fastapi  # noqa: F401
        import pymongo  # noqa: F401
        import requests  # noqa: F401
        print("Dependances backend detectees correctement")
    except ImportError as exc:
        print(f"Dependance manquante : {exc}")
        print("Executez : pip install -r requirements.txt")
        sys.exit(1)

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload_enabled = os.getenv("RELOAD", "True").lower() == "true"

    print("Configuration du serveur :")
    print(f"  - Hote : {host}")
    print(f"  - Port : {port}")
    print(f"  - Rechargement automatique : {reload_enabled}")
    print()

    print("Documentation du projet :")
    print(f"  - Swagger UI : http://localhost:{port}/api/docs")
    print(f"  - ReDoc      : http://localhost:{port}/api/redoc")
    print()

    print("Points d'entree utiles :")
    print(f"  - Accueil : http://localhost:{port}/")
    print(f"  - Sante   : http://localhost:{port}/api/health")
    print()

    # Lancement du frontend en arriere-plan
    frontend_dir = Path(__file__).parent.parent / "frontend"
    frontend_proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", "5500"],
        cwd=frontend_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"Frontend demarre sur http://localhost:5500 (PID {frontend_proc.pid})")
    print("-" * 50)

    try:
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=reload_enabled,
            log_level="info",
        )
    finally:
        frontend_proc.terminate()
