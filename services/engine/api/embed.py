"""
Embedding API

POST /api/embed/batch — generate vector embeddings for a list of text items.
POST /api/embed/query — generate a single embedding for a search query.
Uses fastembed with paraphrase-multilingual-MiniLM-L12-v2 (384 dims).
Max 100 items per request (batch).
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


# ─── Query embedding ───────────────────────────────────────────────────────────


class EmbedQueryRequest(BaseModel):
    text: str


class EmbedQueryResponse(BaseModel):
    embedding: list[float]


@router.post("/query", response_model=EmbedQueryResponse)
async def embed_query(req: EmbedQueryRequest) -> EmbedQueryResponse:
    """
    Generate a single 384-dimensional embedding for a search query string.
    Used by the semantic search feature on the Next.js side.
    """
    agent = EmbedderAgent()

    if not agent.is_configured():
        return EmbedQueryResponse(embedding=[])

    results = await agent.embed_batch(
        [EmbedRequest(id="query", text=req.text.strip())]
    )
    if results and results[0].embedding:
        return EmbedQueryResponse(embedding=results[0].embedding)
    return EmbedQueryResponse(embedding=[])
