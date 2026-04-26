#!/usr/bin/env python3
"""
Met a jour l'URL du tunnel dans tous les fichiers du projet.

Utilisation :
    python set-tunnel.py https://xxxx.loca.lt

Ce script modifie :
  - mobile/constants/api.ts     (API_URL)
  - backend/.env                (GOOGLE_REDIRECT_URI)

La cle GOOGLE_REDIRECT_URI du backend est construite automatiquement
a partir de l'URL fournie.
"""

import re
import sys
from pathlib import Path

RACINE = Path(__file__).parent


def usage():
    print("Utilisation : python set-tunnel.py https://xxxx.loca.lt")
    sys.exit(1)


def mettre_a_jour_api_ts(url: str):
    chemin = RACINE / "mobile" / "constants" / "api.ts"
    contenu = chemin.read_text(encoding="utf-8")
    nouveau = re.sub(
        r'export const API_URL\s*=\s*"[^"]*";',
        f'export const API_URL = "{url}/api";',
        contenu,
    )
    chemin.write_text(nouveau, encoding="utf-8")
    print(f"  api.ts          API_URL = {url}/api")


def mettre_a_jour_env(url: str):
    chemin = RACINE / "backend" / ".env"
    contenu = chemin.read_text(encoding="utf-8")
    nouveau = re.sub(
        r"GOOGLE_REDIRECT_URI=.*",
        f"GOOGLE_REDIRECT_URI={url}/api/auth/google/callback",
        contenu,
    )
    chemin.write_text(nouveau, encoding="utf-8")
    print(f"  .env            GOOGLE_REDIRECT_URI = {url}/api/auth/google/callback")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        usage()

    tunnel = sys.argv[1].rstrip("/")

    if not tunnel.startswith("https://"):
        print("Erreur : l'URL doit commencer par https://")
        usage()

    print(f"\nMise a jour du tunnel : {tunnel}\n")
    mettre_a_jour_api_ts(tunnel)
    mettre_a_jour_env(tunnel)

    print()
    print("N'oubliez pas d'ajouter dans Google Console :")
    print(f"  {tunnel}/api/auth/google/callback")
    print()
    print("Redemarrez le backend pour appliquer les changements.")
