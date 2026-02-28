"""
Entity Extractor Agent

Uses Claude Haiku to extract named entities from a single content item.
Returns structured entity data (label, type, salience, context) for
storage by the caller.
"""

import asyncio
import logging
from dataclasses import dataclass, field

import anthropic

from config import settings

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

_MODEL = "claude-haiku-4-5-20251001"
_MAX_TEXT_CHARS = 3_000   # truncate before sending to LLM
_MAX_RETRIES = 3

_ENTITY_TYPE_VALUES = [
    "BRAND",
    "PERSON",
    "ORGANIZATION",
    "TOPIC",
    "PRODUCT",
    "LOCATION",
    "CONCEPT",
    "OTHER",
]

_TOOL_DEF: dict = {
    "name": "extract_entities",
    "description": (
        "Extract all named entities that are relevant to understanding "
        "the main subjects of the provided content."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "entities": {
                "type": "array",
                "description": "Named entities extracted from the content.",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {
                            "type": "string",
                            "description": "The entity name as it appears in the text.",
                        },
                        "type": {
                            "type": "string",
                            "enum": _ENTITY_TYPE_VALUES,
                            "description": (
                                "BRAND: company or brand name; "
                                "PERSON: individual person; "
                                "ORGANIZATION: institution or org; "
                                "TOPIC: subject or theme; "
                                "PRODUCT: specific product or service; "
                                "LOCATION: place or region; "
                                "CONCEPT: abstract idea or methodology; "
                                "OTHER: anything else."
                            ),
                        },
                        "salience": {
                            "type": "number",
                            "description": (
                                "How central this entity is to the content "
                                "(0.0 = peripheral, 1.0 = main subject)."
                            ),
                        },
                        "context": {
                            "type": "string",
                            "description": (
                                "A short text snippet (max 120 chars) showing "
                                "the entity in context. Optional."
                            ),
                        },
                    },
                    "required": ["label", "type", "salience"],
                },
            }
        },
        "required": ["entities"],
    },
}


# ─── Data classes ─────────────────────────────────────────────────────────────


@dataclass
class ExtractedEntity:
    label: str
    type: str
    salience: float
    context: str | None = None


@dataclass
class ItemExtractionResult:
    content_id: str
    entities: list[ExtractedEntity] = field(default_factory=list)
    error: str | None = None


# ─── Agent ────────────────────────────────────────────────────────────────────


class EntityExtractorAgent:
    """
    Extracts named entities from a single content item using Claude Haiku.

    One API call per item; processes items sequentially to respect
    rate limits. Retries on 429/529 with exponential backoff.
    """

    def __init__(self) -> None:
        self._client: anthropic.AsyncAnthropic | None = None

    def _get_client(self) -> anthropic.AsyncAnthropic:
        if self._client is None:
            self._client = anthropic.AsyncAnthropic(
                api_key=settings.anthropic_api_key
            )
        return self._client

    def is_configured(self) -> bool:
        return bool(settings.anthropic_api_key)

    async def extract(
        self,
        content_id: str,
        title: str,
        text: str,
    ) -> ItemExtractionResult:
        """
        Extract entities from one content item.

        Returns ItemExtractionResult with entities list on success,
        or error string on failure.
        """
        truncated = text[:_MAX_TEXT_CHARS]
        prompt = (
            f"Title: {title}\n\n"
            f"Content:\n{truncated}\n\n"
            "Extract all relevant named entities from the content above."
        )

        client = self._get_client()
        last_error: str = "Unknown error"

        for attempt in range(_MAX_RETRIES):
            try:
                response = await client.messages.create(
                    model=_MODEL,
                    max_tokens=1024,
                    tools=[_TOOL_DEF],  # type: ignore[arg-type]
                    tool_choice={"type": "tool", "name": "extract_entities"},
                    messages=[{"role": "user", "content": prompt}],
                )
            except anthropic.RateLimitError:
                wait = 2**attempt  # 1s, 2s, 4s
                logger.warning(
                    "Rate limit for content %s, retry in %ds (%d/%d)",
                    content_id,
                    wait,
                    attempt + 1,
                    _MAX_RETRIES,
                )
                if attempt < _MAX_RETRIES - 1:
                    await asyncio.sleep(wait)
                    continue
                return ItemExtractionResult(
                    content_id=content_id,
                    error="Rate limit exceeded after retries",
                )
            except anthropic.APIStatusError as exc:
                last_error = f"API error {exc.status_code}: {exc.message}"
                logger.error("API error for content %s: %s", content_id, last_error)
                return ItemExtractionResult(content_id=content_id, error=last_error)
            except Exception as exc:
                last_error = str(exc)
                logger.error(
                    "Unexpected error for content %s: %s", content_id, last_error
                )
                return ItemExtractionResult(content_id=content_id, error=last_error)

            # ── Parse tool_use result ─────────────────────────────────────────
            entities: list[ExtractedEntity] = []
            for block in response.content:
                if block.type == "tool_use" and block.name == "extract_entities":
                    raw_list = block.input.get("entities", [])
                    for e in raw_list:
                        label = str(e.get("label", "")).strip()
                        if not label:
                            continue
                        entity_type = str(e.get("type", "OTHER")).upper()
                        if entity_type not in _ENTITY_TYPE_VALUES:
                            entity_type = "OTHER"
                        salience = float(e.get("salience", 0.5))
                        salience = max(0.0, min(1.0, salience))
                        ctx = e.get("context")
                        context_str = str(ctx)[:120] if ctx else None
                        entities.append(
                            ExtractedEntity(
                                label=label,
                                type=entity_type,
                                salience=salience,
                                context=context_str,
                            )
                        )
                    break

            return ItemExtractionResult(content_id=content_id, entities=entities)

        return ItemExtractionResult(content_id=content_id, error=last_error)
