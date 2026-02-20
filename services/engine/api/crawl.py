from fastapi import APIRouter, Depends
from pydantic import BaseModel, HttpUrl, field_validator

from agents.crawler import CrawlerAgent, CrawlResult, PageData
from api.deps import verify_api_key

router = APIRouter(
    prefix="/api/crawl",
    tags=["Crawl"],
    dependencies=[Depends(verify_api_key)],
)


# ─── Request / Response models ────────────────────────────────────────────────


class CrawlSiteRequest(BaseModel):
    url: str
    max_depth: int = 2
    max_pages: int = 50
    rate_limit: float = 1.0  # requests per second

    @field_validator("max_depth")
    @classmethod
    def clamp_depth(cls, v: int) -> int:
        return max(1, min(v, 5))

    @field_validator("max_pages")
    @classmethod
    def clamp_pages(cls, v: int) -> int:
        return max(1, min(v, 200))

    @field_validator("rate_limit")
    @classmethod
    def clamp_rate(cls, v: float) -> float:
        return max(0.1, min(v, 10.0))


class PageResult(BaseModel):
    url: str
    title: str | None = None
    description: str | None = None
    raw_content: str | None = None
    word_count: int | None = None
    excerpt: str | None = None
    published_at: str | None = None


class CrawlSiteResponse(BaseModel):
    pages: list[PageResult]
    crawled_count: int
    error_count: int
    errors: list[dict[str, str]]


# ─── Endpoint ─────────────────────────────────────────────────────────────────


@router.post("/site", response_model=CrawlSiteResponse)
async def crawl_site(req: CrawlSiteRequest) -> CrawlSiteResponse:
    """
    Crawl a website starting from the given URL.

    Follows internal links up to `max_depth` levels, extracts text content
    and metadata from each page. Protected by X-Engine-API-Key header.
    """
    agent = CrawlerAgent(rate_limit=req.rate_limit)
    result: CrawlResult = await agent.crawl(
        start_url=req.url,
        max_depth=req.max_depth,
        max_pages=req.max_pages,
    )

    pages = [
        PageResult(
            url=p.url,
            title=p.title,
            description=p.description,
            raw_content=p.raw_content,
            word_count=p.word_count,
            excerpt=p.excerpt,
            published_at=p.published_at,
        )
        for p in result.pages
    ]

    return CrawlSiteResponse(
        pages=pages,
        crawled_count=result.crawled_count,
        error_count=result.error_count,
        errors=result.errors,
    )
