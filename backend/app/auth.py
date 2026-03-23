"""
Fonctions utilitaires liees a l'authentification.

Ce module centralise :
- le hachage des mots de passe
- la verification des mots de passe
- la creation des jetons JWT
- la lecture et la validation des jetons JWT
"""

import os
from datetime import datetime, timedelta
from typing import Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

contexte_mots_de_passe = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

CLE_SECRETE = os.getenv("SECRET_KEY", "fallback_secret_key_change_this_in_production")
ALGORITHME_JWT = os.getenv("ALGORITHM", "HS256")
DUREE_EXPIRATION_JETON_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


def verifier_mot_de_passe(mot_de_passe_en_clair: str, mot_de_passe_hache: str) -> bool:
    """Verifie si un mot de passe en clair correspond au hash stocke."""
    return contexte_mots_de_passe.verify(mot_de_passe_en_clair, mot_de_passe_hache)


def generer_hash_mot_de_passe(mot_de_passe: str) -> str:
    """Genere un hash securise a partir du mot de passe fourni."""
    return contexte_mots_de_passe.hash(mot_de_passe)


def creer_jeton_acces(
    donnees: Dict,
    duree_expiration: Optional[timedelta] = None,
) -> str:
    """
    Cree un jeton JWT.

    Le contenu du jeton inclut :
    - les donnees de l'utilisateur
    - la date d'expiration
    - la date d'emission
    """
    contenu_a_encoder = donnees.copy()
    expiration = datetime.utcnow() + (
        duree_expiration or timedelta(minutes=DUREE_EXPIRATION_JETON_MINUTES)
    )

    contenu_a_encoder.update({"exp": expiration, "iat": datetime.utcnow()})
    return jwt.encode(contenu_a_encoder, CLE_SECRETE, algorithm=ALGORITHME_JWT)


def decoder_jeton(jeton: str) -> Optional[Dict]:
    """Decode un jeton JWT et retourne son contenu si celui-ci est valide."""
    try:
        return jwt.decode(jeton, CLE_SECRETE, algorithms=[ALGORITHME_JWT])
    except JWTError as exc:
        print(f"[JWT] Erreur de decodage : {exc}")
        return None


def verifier_jeton(jeton: str) -> Optional[str]:
    """Valide un jeton JWT et retourne l'identifiant utilisateur contenu dans `sub`."""
    contenu = decoder_jeton(jeton)
    if contenu:
        return contenu.get("sub")
    return None
