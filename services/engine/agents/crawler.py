"""
Web Crawler Agent

Crawls a site starting from a given URL, extracts text content and metadata,
and returns structured page data for storage by the caller.
"""

import asyncio
import re
import time
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup, Tag

# ─── Constants ────────────────────────────────────────────────────────────────

USER_AGENT = (
    "VisibleeBot/1.0 (Visiblee; content discovery; "
    "contact: bot@visiblee.com)"
)

# Tags whose entire subtree is noise
_NOISE_TAGS = frozenset(
    {
        "script",
        "style",
        "nav",
        "header",
        "footer",
        "aside",
        "noscript",
        "iframe",
        "form",
        "button",
        "input",
        "select",
        "textarea",
        "label",
    }
)

# class/id patterns indicating noise elements
_NOISE_PATTERN = re.compile(
    r"\b(nav|menu|sidebar|footer|header|ads?|advertisement|cookie|popup|"
    r"modal|social|share|related|comment|breadcrumb|pagination|widget|banner)\b",
    re.IGNORECASE,
)

# Max raw_content length to store (characters)
_MAX_CONTENT_CHARS = 100_000

# Max excerpt length
_EXCERPT_CHARS = 300


# ─── Data classes ─────────────────────────────────────────────────────────────


@dataclass
class PageData:
    url: str
    title: str | None = None
    description: str | None = None
    raw_content: str | None = None
    word_count: int | None = None
    excerpt: str | None = None
    published_at: str | None = None  # ISO date YYYY-MM-DD


@dataclass
class CrawlResult:
    pages: list[PageData] = field(default_factory=list)
    crawled_count: int = 0
    error_count: int = 0
    errors: list[dict[str, str]] = field(default_factory=list)


@dataclass
class ExtractResult:
    url: str
    title: str | None = None
    raw_content: str | None = None
    word_count: int | None = None
    excerpt: str | None = None
    published_at: str | None = None
    error: str | None = None


# ─── Agent ────────────────────────────────────────────────────────────────────


class CrawlerAgent:
    """
    Async BFS crawler.

    Args:
        rate_limit: Max requests per second (across the whole crawl).
        timeout:    Per-request timeout in seconds.
    """

    def __init__(self, rate_limit: float = 1.0, timeout: float = 15.0) -> None:
        self._interval = 1.0 / max(rate_limit, 0.1)
        self._timeout = timeout
        self._last_req: float = 0.0

    async def crawl(
        self,
        start_url: str,
        max_depth: int = 2,
        max_pages: int = 50,
    ) -> CrawlResult:
        result = CrawlResult()
        visited: set[str] = set()
        # BFS queue: (url, depth)
        queue: list[tuple[str, int]] = [(start_url, 0)]

        parsed_start = urlparse(start_url)
        base_domain = parsed_start.netloc  # e.g. "example.com"

        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "it,en;q=0.9",
        }

        async with httpx.AsyncClient(
            headers=headers,
            timeout=self._timeout,
            follow_redirects=True,
            max_redirects=5,
        ) as client:
            while queue and result.crawled_count < max_pages:
                url, depth = queue.pop(0)
                norm = _normalize_url(url)

                if norm in visited:
                    continue
                visited.add(norm)

                await self._rate_wait()

                page_data, links, error = await self._fetch_page_with_retry(client, url)

                if error:
                    result.errors.append({"url": url, "error": error})
                    result.error_count += 1
                    continue

                if page_data:
                    result.pages.append(page_data)
                    result.crawled_count += 1

                    # Enqueue internal links if we can still go deeper
                    if depth < max_depth and links:
                        for link in links:
                            if _same_domain(link, base_domain):
                                norm_link = _normalize_url(link)
                                if norm_link not in visited:
                                    queue.append((link, depth + 1))

        return result

    async def _fetch_page_with_retry(
        self,
        client: httpx.AsyncClient,
        url: str,
        max_retries: int = 2,
    ) -> tuple[PageData | None, list[str], str | None]:
        """Retry wrapper around _fetch_page for transient network/server errors."""
        for attempt in range(max_retries + 1):
            page_data, links, error = await self._fetch_page(client, url)
            if error is None or attempt >= max_retries:
                return page_data, links, error
            # Only retry on connection errors or 5xx responses
            is_retryable = (
                "connection" in error.lower()
                or "timed out" in error.lower()
                or error.startswith("HTTP 5")
            )
            if not is_retryable:
                return page_data, links, error
            await asyncio.sleep(1.5 * (attempt + 1))  # 1.5s, 3s
        return None, [], error  # type: ignore[return-value]

    async def _fetch_page(
        self, client: httpx.AsyncClient, url: str
    ) -> tuple[PageData | None, list[str], str | None]:
        """
        Fetch a single URL.

        Returns (page_data, internal_links, error_message).
        """
        try:
            resp = await client.get(url)
        except httpx.TimeoutException:
            return None, [], "timeout"
        except httpx.TooManyRedirects:
            return None, [], "too many redirects"
        except httpx.RequestError as exc:
            return None, [], str(exc)

        content_type = resp.headers.get("content-type", "")
        if "text/html" not in content_type:
            return None, [], None  # silently skip non-HTML

        if resp.status_code >= 400:
            return None, [], f"HTTP {resp.status_code}"

        final_url = str(resp.url)
        html = resp.text

        soup = BeautifulSoup(html, "lxml")
        page_data = _extract_page_data(soup, final_url)
        links = _extract_links(soup, final_url)

        return page_data, links, None

    async def _rate_wait(self) -> None:
        elapsed = time.monotonic() - self._last_req
        wait = self._interval - elapsed
        if wait > 0:
            await asyncio.sleep(wait)
        self._last_req = time.monotonic()


# ─── Extraction helpers ───────────────────────────────────────────────────────


def _extract_page_data(soup: BeautifulSoup, url: str) -> PageData:
    title = _get_title(soup)
    description = _get_description(soup)
    published_at = _get_published_at(soup)
    raw_content, word_count = _get_main_content(soup)
    excerpt = raw_content[:_EXCERPT_CHARS].strip() if raw_content else None

    return PageData(
        url=url,
        title=title or url,
        description=description,
        raw_content=raw_content,
        word_count=word_count,
        excerpt=excerpt,
        published_at=published_at,
    )


def _get_title(soup: BeautifulSoup) -> str | None:
    for attr, val in [("property", "og:title"), ("name", "twitter:title")]:
        tag = soup.find("meta", attrs={attr: val})
        if tag and isinstance(tag, Tag) and tag.get("content"):
            return str(tag["content"]).strip()[:500]
    title_tag = soup.find("title")
    if title_tag:
        return title_tag.get_text(strip=True)[:500]
    h1 = soup.find("h1")
    if h1 and isinstance(h1, Tag):
        return h1.get_text(strip=True)[:500]
    return None


def _get_description(soup: BeautifulSoup) -> str | None:
    for attr, val in [
        ("property", "og:description"),
        ("name", "description"),
        ("name", "twitter:description"),
    ]:
        tag = soup.find("meta", attrs={attr: val})
        if tag and isinstance(tag, Tag) and tag.get("content"):
            return str(tag["content"]).strip()[:500]
    return None


_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")


def _get_published_at(soup: BeautifulSoup) -> str | None:
    # Check meta tags for publication date
    for attr, val in [
        ("property", "article:published_time"),
        ("property", "og:article:published_time"),
        ("name", "date"),
        ("name", "pubdate"),
        ("name", "DC.date"),
        ("itemprop", "datePublished"),
    ]:
        tag = soup.find("meta", attrs={attr: val})
        if tag and isinstance(tag, Tag) and tag.get("content"):
            raw = str(tag["content"])[:10]
            if _DATE_RE.match(raw):
                return raw

    # Check <time datetime="...">
    for time_tag in soup.find_all("time", attrs={"datetime": True}):
        if isinstance(time_tag, Tag):
            raw = str(time_tag.get("datetime", ""))[:10]
            if _DATE_RE.match(raw):
                return raw

    return None


def _get_main_content(soup: BeautifulSoup) -> tuple[str, int]:
    """
    Returns (raw_content_str, word_count).

    Clones the soup to avoid mutating the original (needed for link extraction).
    """
    # Work on a copy so link extraction isn't affected
    clone = BeautifulSoup(str(soup), "lxml")

    # Remove noise tags
    for tag in clone.find_all(_NOISE_TAGS):
        tag.decompose()

    # Remove elements whose class or id looks like noise
    for tag in clone.find_all(True):
        if not isinstance(tag, Tag):
            continue
        classes = " ".join(tag.get("class") or [])
        tag_id = tag.get("id") or ""
        if _NOISE_PATTERN.search(classes) or _NOISE_PATTERN.search(str(tag_id)):
            tag.decompose()

    # Find the most likely main content container
    main = (
        clone.find("main")
        or clone.find("article")
        or clone.find(id=re.compile(r"(content|main|article|post|body)", re.I))
        or clone.find(class_=re.compile(r"(content|main|article|post|entry)", re.I))
        or clone.find("body")
    )

    if not main or not isinstance(main, Tag):
        return "", 0

    text = " ".join(main.get_text(separator=" ").split())
    word_count = len(text.split())
    return text[:_MAX_CONTENT_CHARS], word_count


def _extract_links(soup: BeautifulSoup, base_url: str) -> list[str]:
    links: list[str] = []
    for tag in soup.find_all("a", href=True):
        if not isinstance(tag, Tag):
            continue
        href = str(tag["href"]).strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        full = urljoin(base_url, href)
        parsed = urlparse(full)
        if parsed.scheme in ("http", "https"):
            links.append(full)
    return links


# ─── Single-URL extraction ────────────────────────────────────────────────────


async def extract_urls(
    urls: list[str],
    concurrency: int = 5,
    timeout: float = 15.0,
) -> list[ExtractResult]:
    """
    Fetch and extract content from a list of URLs concurrently.

    Each URL is processed independently; a failure on one URL does not
    affect the others. Returns one ExtractResult per input URL, preserving order.
    """
    sem = asyncio.Semaphore(concurrency)
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it,en;q=0.9",
    }

    async def _fetch_one(client: httpx.AsyncClient, url: str) -> ExtractResult:
        async with sem:
            try:
                resp = await client.get(url)
            except httpx.TimeoutException:
                return ExtractResult(url=url, error="timeout")
            except httpx.TooManyRedirects:
                return ExtractResult(url=url, error="too many redirects")
            except httpx.RequestError as exc:
                return ExtractResult(url=url, error=str(exc))

            if resp.status_code >= 400:
                return ExtractResult(url=url, error=f"HTTP {resp.status_code}")

            content_type = resp.headers.get("content-type", "")
            if "text/html" not in content_type:
                return ExtractResult(
                    url=url, error=f"non-HTML content-type: {content_type[:60]}"
                )

            soup = BeautifulSoup(resp.text, "lxml")
            page = _extract_page_data(soup, str(resp.url))

            return ExtractResult(
                url=url,
                title=page.title,
                raw_content=page.raw_content,
                word_count=page.word_count,
                excerpt=page.excerpt,
                published_at=page.published_at,
            )

    async with httpx.AsyncClient(
        headers=headers,
        timeout=timeout,
        follow_redirects=True,
        max_redirects=5,
    ) as client:
        tasks = [_fetch_one(client, url) for url in urls]
        return list(await asyncio.gather(*tasks))


# ─── URL utilities ────────────────────────────────────────────────────────────


def _normalize_url(url: str) -> str:
    """Strip fragment and trailing slash for visited-set deduplication."""
    p = urlparse(url)
    path = p.path.rstrip("/") or "/"
    normalized = urlunparse((p.scheme, p.netloc, path, p.params, p.query, ""))
    return normalized.lower()


def _same_domain(url: str, base_domain: str) -> bool:
    """True if url shares the same registered domain (allows www. prefix)."""
    host = urlparse(url).netloc.lower()
    bd = base_domain.lower()
    return host == bd or host == f"www.{bd}" or bd == f"www.{host}"
