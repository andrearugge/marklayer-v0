"""
Analyze API

POST /api/analyze/topics  — cluster content items by embedding similarity
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from agents.clusterer import ClusterItem, TopicClusterer
from api.deps import verify_api_key

router = APIRouter(prefix="/api/analyze", tags=["analyze"])

_clusterer = TopicClusterer()


# ─── Request / Response models ────────────────────────────────────────────────


class ClusterItemRequest(BaseModel):
    id: str
    title: str
    embedding: list[float]


class ClusterAssignmentResponse(BaseModel):
    id: str
    cluster_idx: int
    topic_label: str
    confidence: float


class ClusterTopicsRequest(BaseModel):
    items: list[ClusterItemRequest]


class ClusterTopicsResponse(BaseModel):
    assignments: list[ClusterAssignmentResponse]
    clusters_found: int
    error: str | None = None


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/topics", response_model=ClusterTopicsResponse)
async def cluster_topics(
    body: ClusterTopicsRequest,
    _: None = Depends(verify_api_key),
) -> ClusterTopicsResponse:
    """
    Cluster content items by embedding similarity and label each cluster.

    Requires at least 6 items; returns a soft error in the response body
    (not an HTTP error) if the minimum is not met.
    """
    items = [ClusterItem(id=r.id, embedding=r.embedding) for r in body.items]
    titles = {r.id: r.title for r in body.items}

    result = await _clusterer.cluster(items, titles)

    return ClusterTopicsResponse(
        assignments=[
            ClusterAssignmentResponse(
                id=a.id,
                cluster_idx=a.cluster_idx,
                topic_label=a.topic_label,
                confidence=a.confidence,
            )
            for a in result.assignments
        ],
        clusters_found=result.clusters_found,
        error=result.error,
    )
