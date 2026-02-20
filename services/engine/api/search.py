from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from agents.search import SearchAgent, build_query
from api.deps import verify_api_key

router = APIRouter(
    prefix="/api/search",
    tags=["Search"],
    dependencies=[Depends(verify_api_key)],
)

# Platforms the search agent understands
VALID_PLATFORMS = frozenset(
    {
        "SUBSTACK",
        "MEDIUM",
        "LINKEDIN",
        "REDDIT",
        "YOUTUBE",
        "TWITTER",
        "QUORA",
        "NEWS",
        "WEBSITE",
        "OTHER",
    }
)


# ─── Request / Response models ────────────────────────────────────────────────


class SearchPlatformRequest(BaseModel):
    brand: str
    domain: str | None = None
    platforms: list[str]
    max_results_per_platform: int = 10

    @field_validator("brand")
    @classmethod
    def brand_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("brand must not be empty")
        return v[:200]

    @field_validator("platforms")
    @classmethod
    def validate_platforms(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("at least one platform is required")
        invalid = [p for p in v if p not in VALID_PLATFORMS]
        if invalid:
            raise ValueError(f"unknown platforms: {invalid}")
        return v

    @field_validator("max_results_per_platform")
    @classmethod
    def clamp_results(cls, v: int) -> int:
        return max(1, min(v, 10))


class SearchResultItem(BaseModel):
    url: str
    title: str
    snippet: str | None = None
    platform: str


class SearchPlatformResponse(BaseModel):
    results: list[SearchResultItem]
    total_found: int
    errors: list[dict[str, str]]


# ─── Endpoint ─────────────────────────────────────────────────────────────────


@router.post("/platform", response_model=SearchPlatformResponse)
async def search_platform(req: SearchPlatformRequest) -> SearchPlatformResponse:
    """
    Search for brand mentions across one or more platforms via Google CSE.

    Requires GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID to be configured.
    Protected by X-Engine-API-Key header.
    """
    agent = SearchAgent()
    if not agent.is_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Google Custom Search not configured. "
                "Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID environment variables."
            ),
        )

    result = await agent.search(
        brand=req.brand,
        domain=req.domain,
        platforms=req.platforms,
        max_results_per_platform=req.max_results_per_platform,
    )

    items = [
        SearchResultItem(
            url=r.url,
            title=r.title,
            snippet=r.snippet,
            platform=r.platform,
        )
        for r in result.results
    ]

    return SearchPlatformResponse(
        results=items,
        total_found=result.total_found,
        errors=result.errors,
    )


@router.get("/platform/preview")
async def preview_queries(
    brand: str,
    domain: str | None = None,
) -> dict[str, str | None]:
    """
    Preview the search queries that would be generated for each platform.
    Useful for debugging. Protected by X-Engine-API-Key header.
    """
    return {
        platform: build_query(platform, brand, domain)
        for platform in sorted(VALID_PLATFORMS)
    }
