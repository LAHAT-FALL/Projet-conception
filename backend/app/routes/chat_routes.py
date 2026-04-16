"""
Route de chatbot propulsee par Groq (llama-3.3-70b-versatile).

Expose un endpoint POST /api/chat permettant a l'utilisateur de poser
des questions au bot. La citation courante peut etre passee en contexte
pour que le bot puisse l'expliquer, analyser, ou la relier a d'autres oeuvres.
"""

import os
from typing import Optional

from groq import Groq
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import verifier_jeton
from app.routes.quotes_routes import obtenir_utilisateur_courant

router = APIRouter()

CLE_API_GROQ = os.getenv("GROQ_API_KEY")

SYSTEM_PROMPT = """Tu es un assistant culturel intégré à QuoteKeeper, une application de gestion de citations favorites.

Tu aides les utilisateurs à :
- Comprendre et expliquer des citations (sens, contexte historique, philosophique ou littéraire)
- Découvrir l'auteur d'une citation et son époque
- Trouver des citations similaires ou thématiquement liées
- Explorer des thèmes comme la sagesse, l'amour, le courage, la philosophie, la littérature
- Répondre à toute question culturelle ou littéraire

Règles :
- Réponds toujours en français, de manière claire et accessible
- Sois concis mais complet (3-6 phrases en général)
- Si une citation est fournie en contexte, centre ta réponse sur elle
- Si la question est hors sujet (technique, politique, etc.), redirige poliment vers les citations et la culture
"""


class MessageChat(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    citation: Optional[dict] = None


class ReponseChat(BaseModel):
    reply: str


@router.post(
    "",
    response_model=ReponseChat,
    summary="Envoyer un message au chatbot Groq",
)
async def chat(
    corps: MessageChat,
    utilisateur_id: str = Depends(obtenir_utilisateur_courant),
):
    """
    Envoie un message a Groq (llama-3.3-70b-versatile) et retourne la reponse.

    Si une citation est fournie dans le corps de la requete, elle est
    injectee dans le prompt comme contexte pour que le bot puisse l'analyser.
    """
    if not CLE_API_GROQ:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Le service de chat n'est pas configure (GROQ_API_KEY manquante).",
        )

    # Construction du prompt avec contexte citation si fourni
    prompt = corps.message
    if corps.citation:
        texte = corps.citation.get("text", "")
        auteur = corps.citation.get("author", "")
        categorie = corps.citation.get("category", "")
        contexte = f'[Citation en contexte] "{texte}" — {auteur} (catégorie : {categorie})\n\n'
        prompt = contexte + prompt

    try:
        client = Groq(api_key=CLE_API_GROQ)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=512,
        )
        return ReponseChat(reply=completion.choices[0].message.content)
    except Exception as exc:
        err = str(exc)
        if "429" in err or "quota" in err.lower() or "rate" in err.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Le quota est temporairement dépassé. Réessayez dans quelques instants.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erreur Groq : {exc}",
        )
