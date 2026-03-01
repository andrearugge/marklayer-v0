# CLAUDE.md — Visiblee

## Stato Corrente

**Step corrente**: 5.4 completato — prossimo: Step 6 (refactor navigazione)
**Ultimo commit**: feat(step-5.4): conversational chat agent — engine SSE, Next.js proxy, ChatPanel
**Aggiornato**: 2026-03-01

---

## Stack Tecnologico

| Layer | Tecnologia | Note |
|-------|-----------|------|
| Frontend | Next.js 16 App Router (`src/`) | `proxy.ts` invece di `middleware.ts` |
| UI | shadcn/ui + Tailwind CSS v4 | |
| ORM | Prisma 7 | `prisma.config.ts`, adapter `PrismaPg` |
| Database | PostgreSQL 16 + pgvector | Docker; indice HNSW su `content_items.embedding` |
| Auth | NextAuth.js v5 (beta.30) | Google OAuth + Credentials |
| Queue | BullMQ + Redis | worker: `npm run worker` da root |
| AI Engine | Python FastAPI (`services/engine/`) | porta 8000, Docker |
| LLM | Claude Haiku `claude-haiku-4-5-20251001` | entity extraction, scoring, chat |
| Embeddings | fastembed ONNX, MiniLM-L12-v2 384 dim | volume `fastembed_models:/app/models` |

---

## Struttura del Progetto

```
apps/web/src/
  app/
    (auth)/          # login, register
    (dashboard)/     # layout sidebar: dashboard, projects, content, graph, settings
    admin/           # users, audit-log
    api/             # tutti gli endpoint Next.js
  lib/               # auth, prisma, audit, projects, queue, scoring, suggestions, content-labels
  workers/           # discovery.ts — processo BullMQ standalone
  prisma/            # schema.prisma, migrations, seed, prisma.config.ts
  proxy.ts           # NextAuth v5 middleware wrapper

services/engine/     # Python FastAPI porta 8000
  agents/            # crawler, search, extractor, embedder, clusterer
  api/               # crawl, search, extract, embed, analyze, chat, health, deps
  config.py          # pydantic-settings
```

---

## Convenzioni

- **Git**: `type(scope): description` — `feat|fix|refactor|docs|chore|test`
- **TypeScript**: strict mode, Zod validazione, Server Components di default, `kebab-case` file, `PascalCase` componenti
- **DB**: `snake_case` tabelle/colonne, UUID PK, `created_at`/`updated_at` ovunque
- **API**: `{ data: T }` successo · `{ error: { message, code } }` errore · paginazione offset-based

---

## Schema DB (modelli chiave)

- **Project** — `id, name, domain, description, status (ACTIVE|ARCHIVED)`
- **ContentItem** — `id, projectId, title, url, rawContent, excerpt, wordCount, contentHash, sourcePlatform, contentType, status (DISCOVERED|APPROVED|REJECTED|ARCHIVED), embedding vector(384), publishedAt, lastCrawledAt`
- **DiscoveryJob** — `id, projectId, jobType (CRAWL_SITE|SEARCH_PLATFORM|FULL_DISCOVERY), status, resultSummary, config`
- **Entity** — `id, projectId, type (BRAND|PERSON|ORGANIZATION|TOPIC|PRODUCT|LOCATION|CONCEPT|OTHER), label, normalizedLabel, frequency`; `@@unique([projectId, normalizedLabel, type])`
- **ContentEntity** — `contentId, entityId, salience, context` (pivot)
- **EntityRelation** — `sourceId, targetId, relationType, weight`
- **ProjectScore** — `id, projectId (unique), overallScore, dimensions (JsonB), suggestions (JsonB), isStale, computedAt`
- **AnalysisJob** — `id, projectId, jobType (FULL_ANALYSIS|EXTRACT_ENTITIES|GENERATE_EMBEDDINGS|CLUSTER_TOPICS|COMPUTE_SCORE|GENERATE_CONTENT_SUGGESTIONS|GENERATE_BRIEFS), status, resultSummary`
- **ContentSuggestion** — `id, contentId (unique), projectId, suggestions (JsonB string[]), generatedAt`
- **ContentBrief** — `id, projectId, title, platform, gapType, gapLabel, keyPoints (JsonB), entities (JsonB), targetWordCount, notes, status (PENDING|ACCEPTED|REJECTED|DONE)`; `@@unique([projectId, gapType, gapLabel])`

> **Embedding**: campo `Unsupported("vector(384)")` — tutte le operazioni via `$queryRawUnsafe`/`$executeRawUnsafe`

---

## API Engine (Python FastAPI)

```
GET  /health
POST /api/crawl/site            — BFS crawler
POST /api/crawl/extract         — estrai rawContent da lista URL
POST /api/search/platform       — Brave Search API per piattaforma
POST /api/extract/entities      — entity extraction via Claude Haiku
POST /api/embed/batch           — embedding batch (fastembed)
POST /api/embed/query           — embedding singola query (per semantic search)
POST /api/analyze/topics        — KMeans clustering + label LLM
POST /api/analyze/suggestions   — suggestions progetto via Claude Haiku
POST /api/analyze/content-suggestion — suggestions per singolo content item
POST /api/analyze/content-brief — genera brief strutturato da gap
POST /api/chat/message          — streaming SSE chat (Anthropic SDK)
```

## API Next.js (route principali per progetto)

```
# Discovery
POST /api/projects/:id/discovery/start|crawl|search
GET  /api/projects/:id/discovery/status|history
POST /api/projects/:id/content/fetch        — batch fetch rawContent

# Analysis
POST /api/projects/:id/analysis/start       — avvia FULL_ANALYSIS
GET  /api/projects/:id/analysis/status
GET  /api/projects/:id/analysis/score
GET  /api/projects/:id/analysis/entities
GET  /api/projects/:id/analysis/topics
POST /api/projects/:id/analysis/suggestions — batch GENERATE_CONTENT_SUGGESTIONS

# Content suggestions
GET  /api/projects/:id/content/:cid/suggestions
POST /api/projects/:id/content/:cid/suggestions  — inline generation

# Briefs
POST /api/projects/:id/briefs/generate
GET  /api/projects/:id/briefs
PATCH/DELETE /api/projects/:id/briefs/:briefId

# Semantic search
POST /api/projects/:id/search/semantic      — embed query + pgvector cosine

# Chat
POST /api/projects/:id/chat                 — SSE proxy, RAG context
```

---

## BullMQ Worker (`workers/discovery.ts`)

Job types gestiti in un unico processo:
- `FULL_DISCOVERY`, `CRAWL_SITE`, `SEARCH_PLATFORM`
- `FULL_ANALYSIS` → pipeline: EXTRACT → EMBED → CLUSTER → SCORE
- `EXTRACT_ENTITIES`, `GENERATE_EMBEDDINGS`, `CLUSTER_TOPICS`, `COMPUTE_SCORE`
- `GENERATE_CONTENT_SUGGESTIONS`, `GENERATE_BRIEFS`

Pattern: `safeUpdateJob()` ignora P2025; `logAudit()` mai throws; engine errors categorizzati.

---

## UI — Pagina Progetto (`/projects/[id]`)

Tab navigation URL-driven (`?tab=`):
- **content** (default) — lista paginata + filtri, breakdown per piattaforma/tipo/status
- **discovery** — avvia job, review DISCOVERED items, storico job
- **analysis** — ScoreCard (5 dimensioni), ContentHealthCard, GapAnalysisCard, SemanticSearchPanel, EntitiesPanel, TopicsPanel, GenerateSuggestionsButton
- **briefs** — BriefsPanel con cards per gap, filtri status, GenerateBriefsButton
- **chat** — ChatPanel streaming con RAG contestuale, suggested prompts

Altre pagine dashboard: `/dashboard` (KPI), `/content` (inventory cross-progetto), `/graph` (force graph entità), `/settings`, `/admin`

---

## Decisioni Architetturali (ADR)

| # | Decisione |
|---|-----------|
| 007 | Platform search: **Brave Search API** (Google CSE abbandonato — 403 org policy) |
| 008 | Python engine Docker separato, porta 8000, shared secret `ENGINE_API_KEY` |
| 009 | Embeddings: **fastembed** ONNX locale, MiniLM-L12-v2 384 dim, no costi API |
| 010 | Entity extraction: Claude Haiku structured tool use, 1 item/call |
| 011 | AI Readiness Score: 5 dimensioni SQL in Next.js; suggestions via Haiku |
| 012 | Per-item suggestions: on demand + cache `ContentSuggestion`, rigenerabile |
| 013 | Content briefs: Haiku JSON output, dedup `(projectId, gapType, gapLabel)` |
| 014 | Semantic search: engine embed query → Next.js pgvector `<=>`, soglia distance < 0.7, solo APPROVED |
| 015 | Chat: stateless, context injection (score + entità + gap + RAG), streaming SSE |

---

## Env Vars

| Variabile | Note |
|-----------|------|
| `DATABASE_URL` | PostgreSQL |
| `AUTH_SECRET` | NextAuth |
| `BRAVE_SEARCH_API_KEY` | 2.000 query/mese gratis |
| `ENGINE_API_KEY` | shared secret Next.js ↔ engine |
| `ENGINE_URL` | `http://localhost:8000` in dev |
| `ANTHROPIC_API_KEY` | Claude API |
| `CHAT_MODEL` | default `claude-haiku-4-5-20251001` |

---

## Note per Claude Code

- **Leggi sempre questo file** prima di iniziare qualsiasi task
- **Aggiorna questo file** dopo ogni step: stato corrente, ultimo commit
- **Un step alla volta**: build OK prima di procedere
- Rebuild Docker engine dopo ogni modifica Python: `docker compose build engine && docker compose up -d engine`
- `prisma generate` dopo ogni `migrate dev`
- Tutti i comandi npm dalla root del monorepo (workspaces)

---

## Prossimo: Step 6 — Refactor Navigazione

Da definire con l'utente: riposizionamento di alcune funzionalità, revisione della struttura tab/sidebar.
