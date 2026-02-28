import time

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["Health"])

_START_TIME = time.time()


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    uptime_seconds: float


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="visiblee-engine",
        version="0.1.0",
        uptime_seconds=round(time.time() - _START_TIME, 1),
    )
