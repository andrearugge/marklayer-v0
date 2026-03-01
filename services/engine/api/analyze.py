"""
Analyze API

POST /api/analyze/topics       — cluster content items by embedding similarity
POST /api/analyze/suggestions  — generate actionable suggestions via Claude Haiku
"""

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

import anthropic

from agents.clusterer import ClusterItem, TopicClusterer
from api.deps import verify_api_key
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analyze", tags=["analyze"])

_clusterer = TopicClusterer()


# ─── Request / Response models ────────────────────────────────────────────────


class ClusterItemRequest(BaseModel):
    id: str
    title: str
    embedding: list[float]


class ClusterAssignmentResponse(BaseModel):
    id: str
    cluster_idx: int
    topic_label: str
    confidence: float


class ClusterTopicsRequest(BaseModel):
    items: list[ClusterItemRequest]


class ClusterTopicsResponse(BaseModel):
    assignments: list[ClusterAssignmentResponse]
    clusters_found: int
    error: str | None = None


# ─── Endpoints ────────────────────────────────────────────────────────────────


_MODEL = "claude-haiku-4-5-20251001"
_MAX_RETRIES = 2


# ─── Suggestions models ───────────────────────────────────────────────────────


class WeakDimension(BaseModel):
    name: str
    value: float


class SuggestionsRequest(BaseModel):
    project_name: str
    dimensions: dict[str, float]
    weak_dimensions: list[WeakDimension]


class SuggestionsResponse(BaseModel):
    suggestions: list[str]


# ─── Suggestions endpoint ─────────────────────────────────────────────────────


@router.post("/suggestions", response_model=SuggestionsResponse)
async def generate_suggestions(
    body: SuggestionsRequest,
    _: None = Depends(verify_api_key),
) -> SuggestionsResponse:
    """
    Generate 3-5 concrete Italian suggestions to improve weak AI Readiness dimensions.
    Falls back to an empty list on error — the caller handles the static fallback.
    """
    if not settings.anthropic_api_key:
        return SuggestionsResponse(suggestions=[])

    dim_lines = "\n".join(
        f"- {d.name}: {d.value:.0f}/100" for d in body.weak_dimensions
    )
    prompt = (
        f"Brand: {body.project_name}\n"
        f"Dimensioni deboli del AI Readiness Score (punteggio < 60):\n{dim_lines}\n\n"
        "Genera da 3 a 5 suggerimenti concreti e pratici in italiano per migliorare "
        "queste dimensioni. Ogni suggerimento deve essere una singola frase breve e "
        "immediatamente actionable. Rispondi con una lista numerata, nient'altro."
    )

    client: anthropic.AsyncAnthropic | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            if client is None:
                client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            response = await client.messages.create(
                model=_MODEL,
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            # Parse numbered list: "1. ...\n2. ..."
            suggestions: list[str] = []
            for line in raw.splitlines():
                line = line.strip()
                if not line:
                    continue
                # Remove leading "1. ", "- ", "• " etc.
                import re
                cleaned = re.sub(r"^[\d]+[.)]\s*|^[-•]\s*", "", line).strip()
                if cleaned:
                    suggestions.append(cleaned)
            return SuggestionsResponse(suggestions=suggestions[:5])
        except anthropic.RateLimitError:
            import asyncio
            if attempt < _MAX_RETRIES - 1:
                await asyncio.sleep(2**attempt)
                continue
        except Exception as exc:
            logger.warning("Suggestions generation failed: %s", exc)
            break

    return SuggestionsResponse(suggestions=[])


# ─── Content-suggestion models ───────────────────────────────────────────────


class ContentSuggestionRequest(BaseModel):
    id: str
    title: str
    text: str
    entities: list[str]
    project_name: str


class ContentSuggestionResponse(BaseModel):
    id: str
    suggestions: list[str]


# ─── Content-suggestion endpoint ──────────────────────────────────────────────


@router.post("/content-suggestion", response_model=ContentSuggestionResponse)
async def generate_content_suggestion(
    body: ContentSuggestionRequest,
    _: None = Depends(verify_api_key),
) -> ContentSuggestionResponse:
    """
    Generate 3-5 concrete Italian improvement suggestions for a single content item
    using Claude Haiku.  Falls back to an empty list on error.
    """
    if not settings.anthropic_api_key:
        return ContentSuggestionResponse(id=body.id, suggestions=[])

    entities_str = (
        ", ".join(body.entities[:10]) if body.entities else "nessuna entità rilevata"
    )
    # Truncate body text to keep prompt within token budget
    truncated_text = body.text[:3000] if body.text else ""

    prompt = (
        f"Progetto: {body.project_name}\n"
        f"Titolo contenuto: {body.title}\n"
        f"Entità menzionate: {entities_str}\n\n"
        f"Testo (estratto):\n{truncated_text}\n\n"
        "Analizza questo contenuto e genera da 3 a 5 suggerimenti concreti e "
        "pratici in italiano per migliorarlo e aumentarne la visibilità nei sistemi "
        "AI. Ogni suggerimento deve essere una singola frase breve, direttamente "
        "actionable (es. 'Aggiungi una sezione dedicata a X', 'Espandi il paragrafo "
        "su Y con esempi concreti'). Rispondi con una lista numerata, nient'altro."
    )

    client: anthropic.AsyncAnthropic | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            if client is None:
                client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            response = await client.messages.create(
                model=_MODEL,
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            import re

            suggestions: list[str] = []
            for line in raw.splitlines():
                line = line.strip()
                if not line:
                    continue
                cleaned = re.sub(r"^[\d]+[.)]\s*|^[-•]\s*", "", line).strip()
                if cleaned:
                    suggestions.append(cleaned)
            return ContentSuggestionResponse(
                id=body.id, suggestions=suggestions[:5]
            )
        except anthropic.RateLimitError:
            import asyncio

            if attempt < _MAX_RETRIES - 1:
                await asyncio.sleep(2**attempt)
                continue
        except Exception as exc:
            logger.warning("Content suggestion generation failed: %s", exc)
            break

    return ContentSuggestionResponse(id=body.id, suggestions=[])


# ─── Content-brief models ────────────────────────────────────────────────────


class ContentBriefRequest(BaseModel):
    gap_type: str
    gap_label: str
    top_entities: list[str]
    existing_titles: list[str]
    platform: str
    project_name: str


class ContentBriefResponse(BaseModel):
    title: str
    key_points: list[str]
    entities: list[str]
    target_word_count: int | None = None
    notes: str | None = None


# ─── Content-brief endpoint ───────────────────────────────────────────────────


@router.post("/content-brief", response_model=ContentBriefResponse)
async def generate_content_brief(
    body: ContentBriefRequest,
    _: None = Depends(verify_api_key),
) -> ContentBriefResponse:
    """
    Generate a structured content brief for a specific gap using Claude Haiku.
    Falls back to a minimal brief on LLM error.
    """
    if not settings.anthropic_api_key:
        return ContentBriefResponse(
            title=f"Contenuto su {body.gap_label}",
            key_points=["Approfondire l'argomento", "Citare fonti autorevoli"],
            entities=body.top_entities[:3],
        )

    entities_str = ", ".join(body.top_entities[:10]) if body.top_entities else "nessuna"
    titles_str = (
        "\n".join(f"- {t}" for t in body.existing_titles[:3])
        if body.existing_titles
        else "nessun contenuto esistente"
    )
    gap_type_labels = {
        "PLATFORM": "Assenza/debolezza su piattaforma",
        "TOPIC": "Topic poco coperto",
        "ENTITY": "Entità citata raramente",
        "FRESHNESS": "Contenuto datato",
    }
    gap_type_label = gap_type_labels.get(body.gap_type, body.gap_type)

    prompt = (
        f"Progetto/Brand: {body.project_name}\n"
        f"Tipo di gap: {gap_type_label}\n"
        f"Gap specifico: {body.gap_label}\n"
        f"Piattaforma target: {body.platform}\n"
        f"Entità chiave del progetto: {entities_str}\n"
        f"Titoli di contenuti esistenti (stile di riferimento):\n{titles_str}\n\n"
        "Genera un brief strutturato per un nuovo contenuto che colmi questo gap. "
        "Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (nient'altro) con questa struttura:\n"
        '{\n'
        '  "title": "titolo proposto (max 80 caratteri)",\n'
        '  "key_points": ["punto 1", "punto 2", "punto 3", "punto 4", "punto 5"],\n'
        '  "entities": ["entità1", "entità2", "entità3"],\n'
        '  "target_word_count": 800,\n'
        '  "notes": "note aggiuntive brevi (opzionale, può essere null)"\n'
        "}\n\n"
        "I key_points devono essere 5 punti concreti da coprire nel contenuto. "
        "Le entities devono essere 3-5 termini/nomi chiave da menzionare. "
        "Il target_word_count deve essere appropriato per la piattaforma (blog: 800-1200, LinkedIn: 400-600, Twitter: 200). "
        "Rispondi solo con JSON, senza markdown, senza testo extra."
    )

    import json

    client: anthropic.AsyncAnthropic | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            if client is None:
                client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            response = await client.messages.create(
                model=_MODEL,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            # Strip possible markdown code fences
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            parsed = json.loads(raw.strip())
            return ContentBriefResponse(
                title=str(parsed.get("title", f"Contenuto su {body.gap_label}")),
                key_points=[str(p) for p in parsed.get("key_points", [])[:5]],
                entities=[str(e) for e in parsed.get("entities", [])[:5]],
                target_word_count=parsed.get("target_word_count"),
                notes=parsed.get("notes") or None,
            )
        except anthropic.RateLimitError:
            import asyncio

            if attempt < _MAX_RETRIES - 1:
                await asyncio.sleep(2**attempt)
                continue
        except Exception as exc:
            logger.warning("Content brief generation failed: %s", exc)
            break

    return ContentBriefResponse(
        title=f"Contenuto su {body.gap_label}",
        key_points=[
            "Introduzione all'argomento",
            "Punti chiave e benefici",
            "Esempi pratici e casi d'uso",
            "Best practice e consigli",
            "Conclusioni e prossimi passi",
        ],
        entities=body.top_entities[:3],
        target_word_count=800,
        notes="Brief generato con fallback statico — rigenera per un brief personalizzato.",
    )


# ─── Cluster topics models ────────────────────────────────────────────────────


@router.post("/topics", response_model=ClusterTopicsResponse)
async def cluster_topics(
    body: ClusterTopicsRequest,
    _: None = Depends(verify_api_key),
) -> ClusterTopicsResponse:
    """
    Cluster content items by embedding similarity and label each cluster.

    Requires at least 6 items; returns a soft error in the response body
    (not an HTTP error) if the minimum is not met.
    """
    items = [ClusterItem(id=r.id, embedding=r.embedding) for r in body.items]
    titles = {r.id: r.title for r in body.items}

    result = await _clusterer.cluster(items, titles)

    return ClusterTopicsResponse(
        assignments=[
            ClusterAssignmentResponse(
                id=a.id,
                cluster_idx=a.cluster_idx,
                topic_label=a.topic_label,
                confidence=a.confidence,
            )
            for a in result.assignments
        ],
        clusters_found=result.clusters_found,
        error=result.error,
    )
