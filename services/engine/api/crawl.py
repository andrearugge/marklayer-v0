from fastapi import APIRouter, Depends
from pydantic import BaseModel, HttpUrl, field_validator

from agents.crawler import CrawlerAgent, CrawlResult, ExtractResult, PageData, extract_urls
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


# ─── /extract ─────────────────────────────────────────────────────────────────


class ExtractRequest(BaseModel):
    urls: list[str]
    concurrency: int = 5

    @field_validator("urls")
    @classmethod
    def validate_urls(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("at least one URL is required")
        return v[:50]  # max 50 per request

    @field_validator("concurrency")
    @classmethod
    def clamp_concurrency(cls, v: int) -> int:
        return max(1, min(v, 10))


class ExtractResultItem(BaseModel):
    url: str
    title: str | None = None
    raw_content: str | None = None
    word_count: int | None = None
    excerpt: str | None = None
    published_at: str | None = None
    error: str | None = None


class ExtractResponse(BaseModel):
    results: list[ExtractResultItem]


@router.post("/extract", response_model=ExtractResponse)
async def extract_content(req: ExtractRequest) -> ExtractResponse:
    """
    Fetch and extract clean text content from one or more URLs.

    URLs are processed concurrently (up to `concurrency` at a time).
    A failure on one URL does not stop others — check the `error` field
    per result. Protected by X-Engine-API-Key header.
    """
    results: list[ExtractResult] = await extract_urls(
        req.urls, concurrency=req.concurrency
    )
    return ExtractResponse(
        results=[
            ExtractResultItem(
                url=r.url,
                title=r.title,
                raw_content=r.raw_content,
                word_count=r.word_count,
                excerpt=r.excerpt,
                published_at=r.published_at,
                error=r.error,
            )
            for r in results
        ]
    )
