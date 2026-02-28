"""
Topic Clusterer Agent

Clusters content items by semantic similarity using KMeans on their
embeddings, then labels each cluster using Claude Haiku.

Algorithm:
  k = max(3, min(12, round(sqrt(n / 2))))
  Validate with silhouette score; reduce k or collapse to 1 if quality < 0.15.
  Label via Claude Haiku prompt: 5 sample titles → 2-4 word Italian label.
"""

import asyncio
import logging
import math
from dataclasses import dataclass, field

import anthropic
import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from config import settings

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

_MODEL = "claude-haiku-4-5-20251001"
_MIN_ITEMS = 6
_MIN_SILHOUETTE = 0.15
_MAX_RETRIES = 3


# ─── Data classes ─────────────────────────────────────────────────────────────


@dataclass
class ClusterItem:
    id: str
    embedding: list[float]


@dataclass
class ClusterAssignment:
    id: str
    cluster_idx: int
    topic_label: str
    confidence: float


@dataclass
class ClusterResult:
    assignments: list[ClusterAssignment] = field(default_factory=list)
    clusters_found: int = 0
    error: str | None = None


# ─── Agent ────────────────────────────────────────────────────────────────────


class TopicClusterer:
    """
    Clusters content items by embedding similarity and labels each cluster.

    KMeans is CPU-bound; it runs in the default thread executor to avoid
    blocking the async event loop. Claude Haiku labeling runs concurrently
    for all clusters after KMeans finishes.
    """

    def __init__(self) -> None:
        self._client: anthropic.AsyncAnthropic | None = None

    def _get_client(self) -> anthropic.AsyncAnthropic:
        if self._client is None:
            self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        return self._client

    def is_configured(self) -> bool:
        return bool(settings.anthropic_api_key)

    # ── KMeans (blocking, runs in executor) ───────────────────────────────────

    def _fit_kmeans(
        self,
        embeddings: "np.ndarray[float, np.dtype[np.float32]]",
        k: int,
    ) -> tuple[
        "np.ndarray[int, np.dtype[np.int32]]",
        "np.ndarray[float, np.dtype[np.float32]]",
        float,
    ]:
        """Return (labels, centroids, silhouette_score)."""
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = km.fit_predict(embeddings)
        centers: "np.ndarray[float, np.dtype[np.float32]]" = km.cluster_centers_

        sil = 0.0
        if k > 1 and len(set(labels.tolist())) > 1:
            sample = min(1_000, len(embeddings))
            sil = float(silhouette_score(embeddings, labels, sample_size=sample))

        return labels, centers, sil

    # ── Cluster labeling (async) ───────────────────────────────────────────────

    async def _label_cluster(self, cluster_idx: int, sample_titles: list[str]) -> str:
        """Generate a 2-4 word Italian label for one cluster."""
        if not self.is_configured():
            return f"Cluster {cluster_idx + 1}"

        client = self._get_client()
        bullet_list = "\n".join(f"- {t}" for t in sample_titles[:5])
        prompt = (
            f"Questi sono i titoli di contenuti simili per argomento:\n{bullet_list}\n\n"
            "Rispondi con un'etichetta tematica di 2-4 parole in italiano che riassuma "
            "l'argomento principale di questo gruppo. Solo l'etichetta, nient'altro."
        )

        for attempt in range(_MAX_RETRIES):
            try:
                response = await client.messages.create(
                    model=_MODEL,
                    max_tokens=32,
                    messages=[{"role": "user", "content": prompt}],
                )
                raw = response.content[0].text.strip().strip("\"'").strip()
                return raw[:60] if raw else f"Cluster {cluster_idx + 1}"
            except anthropic.RateLimitError:
                wait = 2**attempt
                if attempt < _MAX_RETRIES - 1:
                    await asyncio.sleep(wait)
                    continue
                return f"Cluster {cluster_idx + 1}"
            except Exception as exc:
                logger.warning(
                    "Label generation for cluster %d failed: %s", cluster_idx, exc
                )
                return f"Cluster {cluster_idx + 1}"

        return f"Cluster {cluster_idx + 1}"

    # ── Main entry point ──────────────────────────────────────────────────────

    async def cluster(
        self,
        items: list[ClusterItem],
        titles: dict[str, str],
    ) -> ClusterResult:
        """
        Cluster items by embedding and label each cluster.

        Args:
            items:  list of ClusterItem (id, embedding)
            titles: {item_id: title} — used for LLM cluster labeling
        """
        n = len(items)

        if n < _MIN_ITEMS:
            return ClusterResult(
                error=(
                    f"Not enough items for clustering ({n} < {_MIN_ITEMS}). "
                    "Generate embeddings for at least 6 approved content items first."
                )
            )

        mat = np.array([item.embedding for item in items], dtype=np.float32)

        # ── Compute k ─────────────────────────────────────────────────────────
        k = max(3, min(12, round(math.sqrt(n / 2))))

        loop = asyncio.get_event_loop()
        labels, centers, sil = await loop.run_in_executor(
            None, self._fit_kmeans, mat, k
        )

        # ── Silhouette check: try k=2 if quality is poor ──────────────────────
        if sil < _MIN_SILHOUETTE and k > 2:
            labels2, centers2, sil2 = await loop.run_in_executor(
                None, self._fit_kmeans, mat, 2
            )
            if sil2 >= _MIN_SILHOUETTE:
                labels, centers, sil, k = labels2, centers2, sil2, 2
            else:
                # Collapse to one cluster
                labels = np.zeros(n, dtype=np.int32)
                centers = mat.mean(axis=0, keepdims=True).astype(np.float32)
                k = 1

        logger.info("Clusters: k=%d, silhouette=%.3f, n=%d", k, sil, n)

        # ── Build sample titles per cluster ───────────────────────────────────
        cluster_titles: dict[int, list[str]] = {i: [] for i in range(k)}
        for item, cidx in zip(items, labels.tolist()):
            title = titles.get(item.id, "")
            if title:
                cluster_titles[int(cidx)].append(title)

        # ── Label clusters in parallel ────────────────────────────────────────
        label_coros = [
            self._label_cluster(i, cluster_titles.get(i, []))
            for i in range(k)
        ]
        cluster_labels: list[str] = list(await asyncio.gather(*label_coros))

        # ── Build assignments with confidence ─────────────────────────────────
        assignments: list[ClusterAssignment] = []
        for item, cidx_raw in zip(items, labels.tolist()):
            cidx = int(cidx_raw)
            vec = np.array(item.embedding, dtype=np.float32)
            dist = float(np.linalg.norm(vec - centers[cidx]))

            cluster_mask = labels == cidx
            cluster_vecs = mat[cluster_mask]
            dists = np.linalg.norm(cluster_vecs - centers[cidx], axis=1)
            max_dist = float(dists.max()) if len(dists) > 0 else 1.0
            confidence = round(
                max(0.0, min(1.0, 1.0 - dist / max_dist)) if max_dist > 0 else 1.0,
                4,
            )

            assignments.append(
                ClusterAssignment(
                    id=item.id,
                    cluster_idx=cidx,
                    topic_label=cluster_labels[cidx],
                    confidence=confidence,
                )
            )

        return ClusterResult(assignments=assignments, clusters_found=k)
