"""
Routes IA utilisant Groq (Llama 3) — gratuit, rapide, sans quota bloquant.

Endpoints :
- POST /ai/chat     : conversation libre avec l'assistant littéraire
- POST /ai/analyze  : analyse des citations favorites de l'utilisateur
- POST /ai/recommend: recommandations selon l'humeur
"""

import os
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.database import obtenir_collection_utilisateurs
from app.demo_store import get_demo_user_by_id
from app.dependencies import obtenir_utilisateur_courant

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

INSTRUCTION_SYSTEME = """Tu es un assistant littéraire cultivé et chaleureux, spécialisé dans les citations, la philosophie et la littérature mondiale.

Tu aides l'utilisateur à :
- Comprendre le sens profond et le contexte historique des citations
- Découvrir des auteurs ou œuvres similaires
- Explorer des thèmes philosophiques
- Trouver des citations sur un sujet précis

Réponds toujours en français, de façon concise et engageante. Maximum 3 paragraphes."""


# ─── Modèles ──────────────────────────────────────────────────────────────────

class MessageChat(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=2000)


class RequeteChat(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    historique: list[MessageChat] = Field(default_factory=list, max_length=20)


class RequeteRecommend(BaseModel):
    humeur: str = Field(..., min_length=1, max_length=200)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _obtenir_favoris(utilisateur_id: str) -> list[dict]:
    collection = obtenir_collection_utilisateurs()
    if collection is None:
        utilisateur = get_demo_user_by_id(utilisateur_id)
        return list((utilisateur or {}).get("favorite_quotes", {}).values())
    try:
        from bson import ObjectId
        utilisateur = collection.find_one({"_id": ObjectId(utilisateur_id)})
        return list((utilisateur or {}).get("favorite_quotes", {}).values())
    except Exception:
        return []


def _appeler_groq(messages_groq: list[dict]) -> str:
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clé API Groq non configurée. Ajoutez GROQ_API_KEY dans le .env",
        )

    try:
        reponse = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": messages_groq,
                "temperature": 0.7,
                "max_tokens": 1024,
            },
            timeout=30,
        )

        if reponse.status_code != 200:
            detail = reponse.json().get("error", {}).get("message", f"Erreur Groq {reponse.status_code}")
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

        return reponse.json()["choices"][0]["message"]["content"]

    except HTTPException:
        raise
    except requests.Timeout:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="L'IA met trop de temps à répondre.")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


def _resume_favoris(favoris: list[dict]) -> str:
    if not favoris:
        return ""
    lignes = ["Citations favorites de l'utilisateur :"]
    for f in favoris[:10]:
        texte = f.get("text", "")
        auteur = f.get("author", "Auteur inconnu")
        note = f.get("note", "")
        ligne = f'- "{texte}" — {auteur}'
        if note:
            ligne += f' (note personnelle : {note})'
        if texte:
            lignes.append(ligne)
    return "\n".join(lignes)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/chat", summary="Conversation avec l'assistant littéraire")
async def chat(
    requete: RequeteChat,
    utilisateur_id: str = Depends(obtenir_utilisateur_courant),
):
    favoris = _obtenir_favoris(utilisateur_id)
    contexte_favoris = _resume_favoris(favoris)

    system_content = INSTRUCTION_SYSTEME
    if contexte_favoris:
        system_content += f"\n\n{contexte_favoris}"

    messages_groq = [{"role": "system", "content": system_content}]
    for msg in requete.historique:
        messages_groq.append({"role": msg.role, "content": msg.content})
    messages_groq.append({"role": "user", "content": requete.message})

    texte = _appeler_groq(messages_groq)
    return {"reponse": texte}


@router.post("/analyze", summary="Analyse des citations favorites")
async def analyser(utilisateur_id: str = Depends(obtenir_utilisateur_courant)):
    favoris = _obtenir_favoris(utilisateur_id)

    if not favoris:
        return {"reponse": "Vous n'avez pas encore de citations favorites. Ajoutez-en depuis l'onglet Accueil, puis revenez pour une analyse personnalisée !"}

    resume = _resume_favoris(favoris)
    prompt = f"""Voici les citations favorites de l'utilisateur :

{resume}

Fais une analyse littéraire courte et engageante de ces citations :
1. Quels thèmes ou valeurs reviennent souvent ?
2. Que révèlent-elles sur la personnalité ou les intérêts de l'utilisateur ?
3. Suggère un auteur ou une œuvre qu'il pourrait apprécier.

Sois chaleureux et personnel dans ta réponse."""

    messages_groq = [
        {"role": "system", "content": INSTRUCTION_SYSTEME},
        {"role": "user", "content": prompt},
    ]
    texte = _appeler_groq(messages_groq)
    return {"reponse": texte}


@router.post("/recommend", summary="Recommandations de citations selon l'humeur")
async def recommander(
    requete: RequeteRecommend,
    utilisateur_id: str = Depends(obtenir_utilisateur_courant),
):
    favoris = _obtenir_favoris(utilisateur_id)
    contexte = _resume_favoris(favoris)

    prompt = f"""L'utilisateur dit : "{requete.humeur}"

{"Ses citations favorites pour contexte :\n" + contexte if contexte else ""}

Propose 3 citations parfaitement adaptées à son état d'esprit. Pour chaque citation :
- La citation entre guillemets
- L'auteur
- Une phrase expliquant pourquoi elle correspond à son humeur

Sois empathique et inspirant."""

    messages_groq = [
        {"role": "system", "content": INSTRUCTION_SYSTEME},
        {"role": "user", "content": prompt},
    ]
    texte = _appeler_groq(messages_groq)
    return {"reponse": texte}
