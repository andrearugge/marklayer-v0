from fastapi import Header, HTTPException

from config import settings


async def verify_api_key(
    x_engine_api_key: str | None = Header(default=None, alias="x-engine-api-key"),
) -> None:
    """Verify the shared API key sent by the Next.js app."""
    if not x_engine_api_key or x_engine_api_key != settings.engine_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
