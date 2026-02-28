from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.crawl import router as crawl_router
from api.health import router as health_router
from api.search import router as search_router
from config import settings

app = FastAPI(
    title="Visiblee Engine",
    description="Visiblee — Content Discovery & Analysis Service",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────

app.include_router(health_router)
app.include_router(crawl_router)
app.include_router(search_router)
