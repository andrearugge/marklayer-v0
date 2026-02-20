"""
Platform Search Agent

Uses the Google Custom Search JSON API to find brand/author mentions
across specific platforms. One query per platform, results deduplicated
by URL before being returned to the caller.
"""

import asyncio
from dataclasses import dataclass, field

import httpx

from config import settings

# ─── Google CSE endpoint ──────────────────────────────────────────────────────

_CSE_URL = "https://www.googleapis.com/customsearch/v1"

# ─── Per-platform query builders ──────────────────────────────────────────────


def build_query(platform: str, brand: str, domain: str | None) -> str | None:
    """
    Return the Google search query for a given platform, or None if the
    platform cannot be searched without a required field (e.g. WEBSITE without
    a domain).
    """
    b = brand.replace('"', "")  # sanitise brand for use inside quotes

    if platform == "WEBSITE":
        if not domain:
            return None  # meaningless without a domain
        return f'site:{domain} "{b}"'

    if platform == "NEWS":
        # External mentions — exclude own domain if provided
        exclusion = f" -site:{domain}" if domain else ""
        return f'"{b}" (news OR articolo OR intervista OR press){exclusion}'

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
    Queries the Google Custom Search JSON API for each requested platform.

    Requires GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID to be set in config.
    Applies a 1-second pause between API calls to stay within quota.
    """

    def is_configured(self) -> bool:
        return bool(settings.google_cse_api_key and settings.google_cse_id)

    async def search(
        self,
        brand: str,
        domain: str | None,
        platforms: list[str],
        max_results_per_platform: int = 10,
    ) -> PlatformSearchResult:
        result = PlatformSearchResult()
        seen_urls: set[str] = set()

        # Clamp to Google CSE maximum (10 per request)
        num = max(1, min(max_results_per_platform, 10))

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

                items, error = await self._call_cse(client, query, num)

                if error:
                    result.errors.append({"platform": platform, "error": error})
                    continue

                for item in items:
                    url = item.get("link", "").strip()
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    result.results.append(
                        SearchResult(
                            url=url,
                            title=item.get("title", url).strip(),
                            snippet=item.get("snippet", "").strip() or None,
                            platform=platform,
                        )
                    )
                result.total_found = len(result.results)

        return result

    async def _call_cse(
        self,
        client: httpx.AsyncClient,
        query: str,
        num: int,
    ) -> tuple[list[dict], str | None]:
        """
        Call the Google CSE API. Returns (items, error_message).
        items is the raw list from response["items"].
        """
        params = {
            "key": settings.google_cse_api_key,
            "cx": settings.google_cse_id,
            "q": query,
            "num": num,
        }

        try:
            resp = await client.get(_CSE_URL, params=params)
        except httpx.RequestError as exc:
            return [], str(exc)

        if resp.status_code == 429:
            return [], "Google CSE daily quota exceeded"
        if resp.status_code == 400:
            return [], "Bad request — check GOOGLE_CSE_ID"
        if resp.status_code == 403:
            return [], "Forbidden — check GOOGLE_CSE_API_KEY or quota"
        if resp.status_code != 200:
            return [], f"HTTP {resp.status_code}"

        data: dict = resp.json()

        # "items" is absent when there are no results (not an error)
        return data.get("items", []), None
