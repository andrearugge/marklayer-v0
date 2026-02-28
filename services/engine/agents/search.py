"""
Platform Search Agent

Uses the Brave Search API to find brand/author mentions across specific
platforms. One query per platform, results deduplicated by URL before
being returned to the caller.
"""

import asyncio
from dataclasses import dataclass, field

import httpx

from config import settings

# ─── Brave Search endpoint ────────────────────────────────────────────────────

_BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"

# ─── Per-platform query builders ──────────────────────────────────────────────


def build_query(platform: str, brand: str, domain: str | None) -> str | None:
    """
    Return the search query for a given platform, or None if the platform
    cannot be searched without a required field (e.g. WEBSITE without a domain).
    """
    b = brand.replace('"', "")  # sanitise brand for use inside quotes

    if platform == "WEBSITE":
        if not domain:
            return None  # meaningless without a domain
        return f'site:{domain} "{b}"'

    if platform == "NEWS":
        # External mentions — exclude own domain if provided
        exclusion = f" -site:{domain}" if domain else ""
        return f'"{b}" (news OR article OR interview OR press){exclusion}'

    _TEMPLATES: dict[str, str] = {
        "SUBSTACK": f'site:substack.com "{b}"',
        "MEDIUM": f'site:medium.com "{b}"',
        "LINKEDIN": f'site:linkedin.com/pulse "{b}"',
        "REDDIT": f'site:reddit.com "{b}"',
        "YOUTUBE": f'site:youtube.com "{b}"',
        "TWITTER": f'site:twitter.com "{b}"',
        "QUORA": f'site:quora.com "{b}"',
        "OTHER": f'"{b}"',
    }
    return _TEMPLATES.get(platform)


# ─── Data classes ─────────────────────────────────────────────────────────────


@dataclass
class SearchResult:
    url: str
    title: str
    snippet: str | None
    platform: str


@dataclass
class PlatformSearchResult:
    results: list[SearchResult] = field(default_factory=list)
    total_found: int = 0
    errors: list[dict[str, str]] = field(default_factory=list)


# ─── Agent ────────────────────────────────────────────────────────────────────


class SearchAgent:
    """
    Queries the Brave Search API for each requested platform.

    Requires BRAVE_SEARCH_API_KEY to be set in config.
    Applies a 1-second pause between API calls to stay within rate limits.
    Brave supports up to 20 results per request (vs Google CSE's 10).
    """

    def is_configured(self) -> bool:
        return bool(settings.brave_search_api_key)

    async def search(
        self,
        brand: str,
        domain: str | None,
        platforms: list[str],
        max_results_per_platform: int = 10,
    ) -> PlatformSearchResult:
        result = PlatformSearchResult()
        seen_urls: set[str] = set()

        # Brave supports up to 20 results per request
        count = max(1, min(max_results_per_platform, 20))

        async with httpx.AsyncClient(timeout=15.0) as client:
            for i, platform in enumerate(platforms):
                query = build_query(platform, brand, domain)
                if query is None:
                    result.errors.append(
                        {
                            "platform": platform,
                            "error": "skipped — requires domain (not provided)",
                        }
                    )
                    continue

                # Polite delay between API calls (skip before first request)
                if i > 0:
                    await asyncio.sleep(1.0)

                items, error = await self._call_brave(client, query, count)

                if error:
                    result.errors.append({"platform": platform, "error": error})
                    continue

                for item in items:
                    url = item.get("url", "").strip()
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    result.results.append(
                        SearchResult(
                            url=url,
                            title=item.get("title", url).strip(),
                            snippet=item.get("description", "").strip() or None,
                            platform=platform,
                        )
                    )
                result.total_found = len(result.results)

        return result

    async def _call_brave(
        self,
        client: httpx.AsyncClient,
        query: str,
        count: int,
    ) -> tuple[list[dict], str | None]:
        """
        Call the Brave Search API. Returns (items, error_message).
        items is the raw list from response["web"]["results"].
        """
        try:
            resp = await client.get(
                _BRAVE_URL,
                params={"q": query, "count": count},
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip",
                    "X-Subscription-Token": settings.brave_search_api_key,
                },
            )
        except httpx.RequestError as exc:
            return [], str(exc)

        if resp.status_code == 429:
            return [], "Brave Search rate limit exceeded"
        if resp.status_code == 401:
            return [], "Unauthorized — check BRAVE_SEARCH_API_KEY"
        if resp.status_code == 422:
            return [], "Unprocessable query"
        if resp.status_code != 200:
            return [], f"HTTP {resp.status_code}"

        data: dict = resp.json()

        # "web" key is absent when there are no results (not an error)
        web = data.get("web", {})
        return web.get("results", []), None
