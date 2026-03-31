"""
Fonctions utilitaires liees a l'authentification.

Ce module centralise :
- le hachage des mots de passe (PBKDF2-SHA256 via passlib)
- la verification des mots de passe
- la creation des jetons JWT signes avec HMAC-SHA256
- la lecture et la validation des jetons JWT

Securite :
- PBKDF2-SHA256 est resistant aux attaques par force brute (derive de cle lente)
- JWT HS256 garantit l'integrite du token sans stocker de session cote serveur
- La cle secrete doit etre longue et aleatoire en production (variable SECRET_KEY)
"""

import os
from datetime import datetime, timedelta
from typing import Dict, Optional

import jwt
from jwt.exceptions import InvalidTokenError as JWTError
from passlib.context import CryptContext

# Contexte de hachage : PBKDF2-SHA256 avec sel aleatoire automatique.
# "deprecated=auto" permet une migration transparente vers de nouveaux algorithmes.
contexte_mots_de_passe = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Cle secrete lue depuis l'environnement. Ne jamais coder cette valeur en dur.
CLE_SECRETE = os.getenv("SECRET_KEY", "fallback_secret_key_change_this_in_production")

# Algorithme de signature du JWT : HMAC-SHA256, standard et largement supporte.
ALGORITHME_JWT = os.getenv("ALGORITHM", "HS256")

# Duree de vie du token en minutes avant expiration automatique (defaut : 30 min).
DUREE_EXPIRATION_JETON_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


def verifier_mot_de_passe(mot_de_passe_en_clair: str, mot_de_passe_hache: str) -> bool:
    """
    Compare un mot de passe en clair avec son hash stocke en base.

    passlib rehache automatiquement si l'algorithme a change depuis la creation.
    Retourne True si le mot de passe correspond, False sinon.
    """
    return contexte_mots_de_passe.verify(mot_de_passe_en_clair, mot_de_passe_hache)


def generer_hash_mot_de_passe(mot_de_passe: str) -> str:
    """
    Genere un hash securise a partir du mot de passe fourni.

    Le sel est genere aleatoirement par passlib a chaque appel.
    Le resultat inclut l'algorithme, les parametres et le sel — tout en un seul champ.
    """
    return contexte_mots_de_passe.hash(mot_de_passe)


def creer_jeton_acces(
    donnees: Dict,
    duree_expiration: Optional[timedelta] = None,
) -> str:
    """
    Cree un jeton JWT signe avec la cle secrete du serveur.

    Le contenu du jeton inclut :
    - les donnees de l'utilisateur (sub = identifiant, email, ...)
    - exp : date d'expiration (Unix timestamp)
    - iat : date d'emission (issued at)

    Le jeton est signe mais pas chiffre — ne pas y stocker de donnees sensibles.
    """
    contenu_a_encoder = donnees.copy()

    # Calcul de la date d'expiration : maintenant + duree configuree
    expiration = datetime.utcnow() + (
        duree_expiration or timedelta(minutes=DUREE_EXPIRATION_JETON_MINUTES)
    )

    # Ajout des claims standards JWT (exp et iat)
    contenu_a_encoder.update({"exp": expiration, "iat": datetime.utcnow()})

    # Encodage et signature du token avec PyJWT
    return jwt.encode(contenu_a_encoder, CLE_SECRETE, algorithm=ALGORITHME_JWT)


def decoder_jeton(jeton: str) -> Optional[Dict]:
    """
    Decode un jeton JWT et retourne son contenu si valide.

    PyJWT verifie automatiquement :
    - la signature (integrite)
    - la date d'expiration (exp)
    Retourne None si le token est invalide ou expire.
    """
    try:
        return jwt.decode(jeton, CLE_SECRETE, algorithms=[ALGORITHME_JWT])
    except JWTError as exc:
        # Token corrompu, signature incorrecte ou expire
        print(f"[JWT] Erreur de decodage : {exc}")
        return None


def verifier_jeton(jeton: str) -> Optional[str]:
    """
    Valide un jeton JWT et retourne l'identifiant utilisateur (champ 'sub').

    Retourne None si le token est invalide, expire ou ne contient pas de 'sub'.
    Utilise par toutes les routes protegees via Depends(obtenir_utilisateur_courant).
    """
    contenu = decoder_jeton(jeton)
    if contenu:
        return contenu.get("sub")
    return None
