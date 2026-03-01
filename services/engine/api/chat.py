"""
Chat API

POST /api/chat/message — stateless conversational agent with streaming SSE.
Context is injected via system prompt; no DB persistence.
"""

import json
import logging
import os
from typing import AsyncIterator

import anthropic
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.deps import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

_MODEL = os.environ.get("CHAT_MODEL", "claude-haiku-4-5-20251001")


# ─── Request models ────────────────────────────────────────────────────────────


class RelevantContent(BaseModel):
    title: str
    excerpt: str | None = None
    score: int


class ChatContext(BaseModel):
    project_name: str
    overall_score: float | None = None
    dimensions: dict[str, float] | None = None
    top_entities: list[str] = []
    recent_gaps: list[str] = []
    relevant_content: list[RelevantContent] = []


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    context: ChatContext


# ─── System prompt builder ────────────────────────────────────────────────────


def _build_system_prompt(ctx: ChatContext) -> str:
    lines = [
        f"Sei un esperto di content strategy e AI visibility per il brand '{ctx.project_name}'.",
        "Rispondi sempre in italiano, in modo conciso e orientato all'azione.",
        "Hai accesso ai dati del content portfolio del brand. Usa queste informazioni per dare risposte contestualizzate.",
        "",
    ]

    if ctx.overall_score is not None:
        lines.append(f"AI Readiness Score globale: {ctx.overall_score:.0f}/100")

    if ctx.dimensions:
        lines.append("Dimensioni dello score:")
        dim_labels = {
            "copertura": "Copertura piattaforme",
            "profondita": "Profondità contenuto",
            "freschezza": "Freschezza",
            "autorita": "Autorevolezza",
            "coerenza": "Coerenza entità",
        }
        for k, v in ctx.dimensions.items():
            label = dim_labels.get(k, k)
            lines.append(f"  - {label}: {v:.0f}/100")

    if ctx.top_entities:
        lines.append(f"\nEntità principali del brand: {', '.join(ctx.top_entities[:10])}")

    if ctx.recent_gaps:
        lines.append("\nGap critici rilevati:")
        for gap in ctx.recent_gaps[:3]:
            lines.append(f"  - {gap}")

    if ctx.relevant_content:
        lines.append("\nContenuti più rilevanti alla domanda dell'utente:")
        for rc in ctx.relevant_content[:3]:
            excerpt = f" — {rc.excerpt}" if rc.excerpt else ""
            lines.append(f"  - [{rc.score}%] {rc.title}{excerpt}")

    lines += [
        "",
        "Linee guida:",
        "- Sii specifico e actionable, non generico",
        "- Quando suggerisci azioni, indica piattaforma e tipo di contenuto",
        "- Se i dati mostrano gap critici, menzionali proattivamente",
        "- Tieni le risposte concise (max 3-4 paragrafi o lista breve)",
    ]

    return "\n".join(lines)


# ─── Streaming generator ──────────────────────────────────────────────────────


async def _stream_chat(req: ChatRequest) -> AsyncIterator[str]:
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        yield f"data: {json.dumps({'error': 'ANTHROPIC_API_KEY non configurata'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    system_prompt = _build_system_prompt(req.context)

    # Build messages from history + current message
    messages = [
        {"role": msg.role, "content": msg.content}
        for msg in req.history
        if msg.role in ("user", "assistant")
    ]
    messages.append({"role": "user", "content": req.message})

    client = anthropic.AsyncAnthropic(api_key=anthropic_key)

    try:
        async with client.messages.stream(
            model=_MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'token': text})}\n\n"
    except anthropic.RateLimitError:
        yield f"data: {json.dumps({'error': 'Rate limit raggiunto. Riprova tra qualche secondo.'})}\n\n"
    except anthropic.APIStatusError as e:
        logger.warning("Chat API error: %s", e)
        yield f"data: {json.dumps({'error': f'Errore API ({e.status_code}). Riprova.'})}\n\n"
    except Exception as e:
        logger.warning("Chat stream error: %s", e)
        yield f"data: {json.dumps({'error': 'Errore durante la generazione della risposta.'})}\n\n"
    finally:
        yield "data: [DONE]\n\n"


# ─── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/message")
async def chat_message(
    body: ChatRequest,
    _: None = Depends(verify_api_key),
) -> StreamingResponse:
    """
    Stateless chat with context injection and SSE streaming.
    Each token is sent as: data: {"token": "..."}\n\n
    Stream ends with: data: [DONE]\n\n
    Errors (non-streaming): data: {"error": "..."}\n\n followed by [DONE]
    """
    return StreamingResponse(
        _stream_chat(body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
