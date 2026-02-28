# CLAUDE.md — AI Visibility Platform

## Stato Corrente

**Fase**: 2 — Content Discovery
**Step corrente**: 2b.3 completato → prossimo: **2b.4 Discovery Job Orchestration**
**Ultimo commit**: feat(step-2b.3): content fetching & extraction agent
**Aggiornato**: 2026-02-28

---

## Stack Tecnologico

| Layer | Tecnologia | Note |
|-------|-----------|------|
| Frontend | Next.js 16 (App Router, `src/`) | `proxy.ts` al posto di `middleware.ts` |
| UI | shadcn/ui + Tailwind CSS v4 | Radix UI primitives |
| ORM | Prisma 7 | `prisma.config.ts`, adapter `PrismaPg` |
| Database | PostgreSQL 16 + pgvector | Docker |
| Auth | NextAuth.js v5 (beta.30) | Google OAuth + Credentials |
| Job Queue | BullMQ + Redis | Task asincroni (Fase 2b+) |
| AI Service | Python FastAPI (`services/engine/`) | porta 8000 |
| LLM | Claude API (Anthropic) | Fase 3+ |
| Container | Docker Compose | postgres + redis + engine |

## Struttura del Progetto

```
apps/web/src/
  app/
    (auth)/            # login, register
    (dashboard)/       # layout sidebar, projects/, content/, graph/, settings/
    admin/             # users/, audit-log/
    api/               # auth/, admin/, me/, projects/[id]/content/, discovery/
  components/          # ui/ auth/ dashboard/ admin/ shared/
  lib/                 # auth.ts, prisma.ts, audit.ts, projects.ts, content-labels.ts, validations/
  prisma/              # schema.prisma, seed.ts, prisma.config.ts
  proxy.ts             # Next.js 16 middleware (NextAuth v5 wrapper)
services/engine/       # Python FastAPI
  agents/              # crawler.py, search.py
  api/                 # crawl.py, search.py, deps.py
  config.py            # pydantic-settings
```

## Convenzioni

### Git
- Commit: `type(scope): description` — types: `feat|fix|refactor|docs|chore|test`
- Un commit = una unità logica di lavoro

### Codice (TypeScript)
- Strict mode; Zod per validazione; Server Components di default
- Naming: `kebab-case` file, `PascalCase` componenti, `camelCase` funzioni, `UPPER_SNAKE_CASE` costanti

### Database
- Tabelle/colonne `snake_case`; UUID come PK; `created_at`/`updated_at` ovunque

### API
- Risposte: `{ data: T }` successo, `{ error: { message, code } }` errore
- Status: 200/201/400/401/403/404/500; paginazione offset-based `{ data, pagination }`

---

## Cronologia Fasi

### ✅ Fase 1 — Foundation (Step 1.0–1.9)
Scaffolding, Docker/DB, NextAuth v5, Auth UI, Proxy Middleware, Dashboard Layout, Admin Panel, Settings, Audit Log, Polish. **27 route, build OK.**

### ✅ Fase 2a — CRUD Manuale (Step 2.0–2.8)
Models/Migration, Projects CRUD API+UI, Content Add/List/Detail/Edit, CSV Import, Bulk Actions, Polish.
- Schema: `Project`, `ContentItem`, `DiscoveryJob` in `schema.prisma`
- Ownership: `assertProjectOwnership()` in `lib/projects.ts`
- Dedup: SHA-256 hash (`url || rawContent`) in campo `contentHash`
- Audit: `logAuditEvent()` in `lib/audit.ts`, `AUDIT_ACTIONS` constants

### Fase 2b — Discovery Agent

#### ✅ Step 2b.0 — Python FastAPI Scaffolding
`services/engine/`: FastAPI app, Dockerfile, health check `GET /health`, CORS, pydantic-settings.

#### ✅ Step 2b.1 — Web Crawler Agent
`agents/crawler.py`: BFS async, httpx, rate limiting, max depth/pages, BeautifulSoup estrazione contenuto.
`api/crawl.py`: `POST /api/crawl/site`.
Next.js: `POST /api/projects/:id/discovery/crawl` → salva ContentItem con `AGENT_CRAWL`/`DISCOVERED`.

#### ✅ Step 2b.2 — Platform Search Agent
`agents/search.py`: SearchAgent con **Brave Search API** (header `X-Subscription-Token`, env `BRAVE_SEARCH_API_KEY`).
Query: `site:platform.com "{brand}"` per tutte le piattaforme; max 20 risultati/request.
`api/search.py`: `POST /api/search/platform` + `GET /api/search/platform/preview`.
Next.js: `POST /api/projects/:id/discovery/search` → mappa platform → `SourcePlatform` + `ContentType`.
> Google CSE scartato: 403 persistente nonostante configurazione corretta (org policy `beconcept.studio`).

#### ✅ Step 2b.3 — Content Fetching & Extraction
`agents/crawler.py`: `ExtractResult` + `extract_urls()` — batch async con `asyncio.Semaphore`, riusa `_extract_page_data`.
`api/crawl.py`: `POST /api/crawl/extract` — fino a 50 URL/request, errori isolati per URL.
Next.js: `POST /api/projects/:id/content/fetch` — trova items con URL ma senza `rawContent`, chiama engine in batch da 20, aggiorna `rawContent`/`wordCount`/`excerpt`/`lastCrawledAt`/`publishedAt`.

#### Step 2b.4 — Discovery Job Orchestration ← PROSSIMO
- [ ] BullMQ job queue: tipi `CRAWL_SITE`, `SEARCH_PLATFORM`, `FULL_DISCOVERY`
- [ ] Tracking in tabella `DiscoveryJob`
- [ ] API Next.js: `POST .../discovery/start`, `GET .../status`, `GET .../history`
- [ ] Progress tracking (percentuale/conteggio) durante esecuzione
- **Done when**: Job avviabili, tracciabili, con stato persistente

#### Step 2b.5 — Discovery Review UI
- [ ] Tab "Discovery" nel progetto: bottone start job, stato corrente, storico
- [ ] Lista risultati `DISCOVERED`: card titolo/URL/piattaforma/snippet
- [ ] Azioni: Approve, Reject, Preview; bulk approve/reject
- **Done when**: Flow discovery → review → approve/reject funzionante

#### Step 2b.6 — Phase 2b Polish
- [ ] Error handling crawler (timeout, 404, rate limit), retry logic
- [ ] UI feedback stati di errore discovery
- [ ] Audit log per discovery jobs
- **Done when**: Discovery robusto, errori gestiti gracefully

---

## Fasi Future (Overview)

| Fase | Contenuto |
|------|-----------|
| 3 | Knowledge Graph: entity extraction, topic clustering, embeddings (pgvector), AI Readiness scoring |
| 4 | Dashboard: graph visualization, gap analysis, competitor benchmark |
| 5 | Content Generation Agent: suggestions, pipeline, platform recommendations |
| 6 | Polish & Launch: onboarding, landing page, Stripe billing, E2E tests |

---

## ADR — Decisioni Architetturali

| # | Decisione |
|---|-----------|
| 005 | Fase 2 split: CRUD first (Next.js), poi FastAPI |
| 006 | Web crawling con librerie proprie (httpx + BeautifulSoup / Playwright) |
| 007 | Platform search: **Brave Search API** (Google CSE scartato) |
| 008 | Python engine come servizio Docker separato, porta 8000 |

---

## Env Vars Chiave

| Variabile | Dove | Note |
|-----------|------|------|
| `DATABASE_URL` | `.env.local` + Docker | PostgreSQL |
| `AUTH_SECRET` | `.env.local` | NextAuth |
| `BRAVE_SEARCH_API_KEY` | `.env` + `.env.local` | 2.000 query/mese gratis |
| `ENGINE_API_KEY` | `.env` + `.env.local` | shared secret Next.js ↔ engine |
| `ENGINE_URL` | `.env.local` | `http://localhost:8000` in dev |
| `ANTHROPIC_API_KEY` | `.env` + `.env.local` | Fase 3+ |

---

## Note per Claude Code

- **Leggi sempre questo file** prima di iniziare qualsiasi task
- **Aggiorna questo file** dopo ogni step completato (stato, ultimo commit, checkbox)
- **Un step alla volta**: completa e verifica prima di procedere
- **Segui le convenzioni** rigorosamente
- **Crea un ADR** per ogni decisione architetturale significativa
