"""
Embedding API

POST /api/embed/batch — generate vector embeddings for a list of text items.
Uses fastembed with paraphrase-multilingual-MiniLM-L12-v2 (384 dims).
Max 100 items per request.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator

from agents.embedder import EmbedderAgent, EmbedRequest, EmbedResult
from api.deps import verify_api_key

router = APIRouter(
    prefix="/api/embed",
    tags=["Embed"],
    dependencies=[Depends(verify_api_key)],
)


# ─── Request / Response models ────────────────────────────────────────────────


class EmbedItemRequest(BaseModel):
    id: str
    text: str


class EmbedItemResponse(BaseModel):
    id: str
    embedding: list[float]
    error: str | None = None


class EmbedBatchRequest(BaseModel):
    items: list[EmbedItemRequest]

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: list[EmbedItemRequest]) -> list[EmbedItemRequest]:
        if not v:
            raise ValueError("at least one item is required")
        return v[:100]  # max 100 per request


class EmbedBatchResponse(BaseModel):
    results: list[EmbedItemResponse]
    dimensions: int = 384


# ─── Endpoint ─────────────────────────────────────────────────────────────────


@router.post("/batch", response_model=EmbedBatchResponse)
async def embed_batch(req: EmbedBatchRequest) -> EmbedBatchResponse:
    """
    Generate 384-dimensional embeddings for a list of text items.

    Uses paraphrase-multilingual-MiniLM-L12-v2 via fastembed (ONNX, CPU).
    The model is loaded on first call and cached for subsequent requests.
    Protected by X-Engine-API-Key header.
    """
    agent = EmbedderAgent()

    if not agent.is_configured():
        return EmbedBatchResponse(
            results=[
                EmbedItemResponse(
                    id=item.id,
                    embedding=[],
                    error="fastembed not installed",
                )
                for item in req.items
            ]
        )

    embed_requests = [EmbedRequest(id=item.id, text=item.text) for item in req.items]
    results: list[EmbedResult] = await agent.embed_batch(embed_requests)

    return EmbedBatchResponse(
        results=[
            EmbedItemResponse(
                id=r.id,
                embedding=r.embedding,
                error=r.error,
            )
            for r in results
        ]
    )
