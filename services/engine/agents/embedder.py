"""
Embedder Agent

Generates dense vector embeddings for text using fastembed (ONNX runtime).
Model: paraphrase-multilingual-MiniLM-L12-v2 — 384 dimensions, multilingual.

The model is downloaded on first use (~90 MB) and cached in /app/models.
Embedding is CPU-only; fastembed uses ONNX runtime (no PyTorch required).
"""

import asyncio
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
_CACHE_DIR = "/app/models"
_MAX_TEXT_CHARS = 4_000   # truncate before embedding


# ─── Data classes ─────────────────────────────────────────────────────────────


@dataclass
class EmbedRequest:
    id: str
    text: str


@dataclass
class EmbedResult:
    id: str
    embedding: list[float] = field(default_factory=list)
    error: str | None = None


# ─── Agent ────────────────────────────────────────────────────────────────────


class EmbedderAgent:
    """
    Generates embeddings for a batch of texts using fastembed.

    The underlying TextEmbedding model is a singleton — loaded once on first
    call and reused for all subsequent requests. Model loading blocks the
    event loop briefly the first time; subsequent calls are fast.

    fastembed.embed() is synchronous; we run it in the default executor to
    avoid blocking the async event loop.
    """

    _model = None  # class-level singleton

    def _get_model(self):  # type: ignore[return]
        if EmbedderAgent._model is None:
            try:
                # Import deferred so the module loads even if fastembed is absent
                from fastembed import TextEmbedding  # type: ignore[import-untyped]

                logger.info("Loading embedding model %s …", _MODEL_NAME)
                EmbedderAgent._model = TextEmbedding(
                    _MODEL_NAME, cache_dir=_CACHE_DIR
                )
                logger.info("Embedding model loaded.")
            except Exception as exc:
                logger.error("Failed to load embedding model: %s", exc)
                raise
        return EmbedderAgent._model

    def is_configured(self) -> bool:
        try:
            import fastembed  # noqa: F401  # type: ignore[import-untyped]
            return True
        except ImportError:
            return False

    def _embed_sync(self, texts: list[str]) -> list[list[float]]:
        """Blocking call — must be run in an executor."""
        model = self._get_model()
        return [emb.tolist() for emb in model.embed(texts)]

    async def embed_batch(self, items: list[EmbedRequest]) -> list[EmbedResult]:
        """
        Embed a list of items concurrently via thread executor.

        Returns one EmbedResult per input item, preserving order.
        """
        if not items:
            return []

        texts = [item.text[:_MAX_TEXT_CHARS] for item in items]

        try:
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(None, self._embed_sync, texts)
        except Exception as exc:
            error_msg = str(exc)
            logger.error("Embedding batch failed: %s", error_msg)
            return [EmbedResult(id=item.id, error=error_msg) for item in items]

        return [
            EmbedResult(id=item.id, embedding=emb)
            for item, emb in zip(items, embeddings)
        ]
