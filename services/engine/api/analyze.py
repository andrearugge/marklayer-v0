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
