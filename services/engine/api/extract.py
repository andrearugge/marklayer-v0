"""
Entity Extraction API

POST /api/extract/entities — extract named entities from a list of content items.
Items are processed sequentially (one Claude Haiku call each) to respect
API rate limits. Max 50 items per request.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator

from agents.extractor import EntityExtractorAgent, ItemExtractionResult
from api.deps import verify_api_key

router = APIRouter(
    prefix="/api/extract",
    tags=["Extract"],
    dependencies=[Depends(verify_api_key)],
)


# ─── Request / Response models ────────────────────────────────────────────────


class ContentItemRequest(BaseModel):
    id: str
    title: str
    text: str


class EntityItem(BaseModel):
    label: str
    type: str
    salience: float
    context: str | None = None


class ItemExtractionResponse(BaseModel):
    id: str
    entities: list[EntityItem]
    error: str | None = None


class ExtractEntitiesRequest(BaseModel):
    items: list[ContentItemRequest]

    @field_validator("items")
    @classmethod
    def validate_items(
        cls, v: list[ContentItemRequest]
    ) -> list[ContentItemRequest]:
        if not v:
            raise ValueError("at least one item is required")
        return v[:50]  # max 50 per request


class ExtractEntitiesResponse(BaseModel):
    results: list[ItemExtractionResponse]


# ─── Endpoint ─────────────────────────────────────────────────────────────────


@router.post("/entities", response_model=ExtractEntitiesResponse)
async def extract_entities(
    req: ExtractEntitiesRequest,
) -> ExtractEntitiesResponse:
    """
    Extract named entities from content items using Claude Haiku.

    Processes items sequentially (one LLM call each).
    Returns one result per input item — check the `error` field for failures.
    Protected by X-Engine-API-Key header.
    """
    agent = EntityExtractorAgent()

    if not agent.is_configured():
        return ExtractEntitiesResponse(
            results=[
                ItemExtractionResponse(
                    id=item.id,
                    entities=[],
                    error="ANTHROPIC_API_KEY not configured",
                )
                for item in req.items
            ]
        )

    results: list[ItemExtractionResponse] = []
    for item in req.items:
        result: ItemExtractionResult = await agent.extract(
            content_id=item.id,
            title=item.title,
            text=item.text,
        )
        results.append(
            ItemExtractionResponse(
                id=result.content_id,
                entities=[
                    EntityItem(
                        label=e.label,
                        type=e.type,
                        salience=e.salience,
                        context=e.context,
                    )
                    for e in result.entities
                ],
                error=result.error,
            )
        )

    return ExtractEntitiesResponse(results=results)
