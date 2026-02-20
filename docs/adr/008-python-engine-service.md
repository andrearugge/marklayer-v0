# ADR-008: Python FastAPI Engine Service Architecture

**Date**: 2026-02-18
**Status**: Accepted

---

## Context

The discovery and analysis pipeline (crawling, NLP, embeddings, LLM inference) requires
capabilities that are better suited to Python than Node.js:

- Rich ecosystem for ML/AI (LangChain, sentence-transformers, spaCy, anthropic SDK)
- Better async support for parallel web crawling (httpx, asyncio)
- Native integration with vector databases and ML libraries

The Next.js app handles user-facing CRUD and UI. A separate Python service handles
all compute-intensive background work.

---

## Decision

Introduce a **Python 3.11 FastAPI** microservice (`services/engine/`) that runs
alongside the Next.js app under Docker Compose.

### Communication pattern

- **Next.js → Engine**: HTTP REST calls (via `ENGINE_URL` env var)
- **Shared secret**: `ENGINE_API_KEY` header (`X-Engine-API-Key`) to prevent unauthorized access
- **Engine → PostgreSQL**: Direct `asyncpg` connection (shares the same DB as Next.js)
- **Engine → Redis**: Direct `redis-py` connection for job queue coordination

### Service structure

```
services/engine/
├── main.py          # FastAPI app, CORS, router registration
├── config.py        # pydantic-settings (reads env vars)
├── api/             # Route handlers (health, crawl, search — added in Fase 2b)
├── agents/          # Discovery agents (crawler, search)
├── embeddings/      # Embedding generation logic
├── graph/           # Knowledge graph operations
├── workers/         # Background worker tasks (BullMQ consumer)
├── requirements.txt
└── Dockerfile
```

### Security

- CORS restricted to `ALLOWED_ORIGINS` (default: `http://localhost:3000`)
- Engine endpoints validate `X-Engine-API-Key` header (to be added in Step 2b.1)
- Engine is not exposed to the internet; in production it sits behind the same VPC

### Ports

| Service   | Port |
|-----------|------|
| Next.js   | 3000 |
| Engine    | 8000 |
| PostgreSQL| 5432 |
| Redis     | 6379 |

---

## Consequences

**Positive**:
- Clear separation of concerns: CRUD in TypeScript, AI/ML in Python
- Python ecosystem for ML is significantly richer than Node.js alternatives
- Independent scaling of the engine service

**Negative**:
- Two runtimes to maintain
- Docker required for local development of the full stack
- Shared database means schema changes in Prisma must be compatible with raw SQL queries from Python

---

## Alternatives Considered

1. **Node.js only** — Limited ML libraries; OpenAI/Anthropic SDKs exist but processing pipelines are better in Python
2. **gRPC** instead of REST — Overkill for this scale; REST is simpler to develop and debug
3. **Separate database for engine** — Adds complexity; sharing the PostgreSQL instance is fine at this scale
