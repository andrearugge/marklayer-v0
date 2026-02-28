# CLAUDE.md — Visiblee

## Stato Corrente

**Fase**: 3 — Knowledge Graph & Analysis
**Step corrente**: 3.2 completato → prossimo: Step 3.3
**Ultimo commit**: feat(step-3.2): embedding generation — fastembed ONNX, GENERATE_EMBEDDINGS job, pgvector update
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

#### ✅ Step 2b.4 — Discovery Job Orchestration
`lib/queue.ts`: BullMQ `Queue<DiscoveryJobPayload>`, tipi `CRAWL_SITE | SEARCH_PLATFORM | FULL_DISCOVERY`, Redis connection da `REDIS_URL`.
`workers/discovery.ts`: processo standalone (`npm run worker`), crea Prisma client dedicato, gestisce i 3 job type, aggiorna `DiscoveryJob` PENDING → RUNNING → COMPLETED/FAILED + `resultSummary`.
API Next.js:
- `POST /api/projects/:id/discovery/start` — valida, crea `DiscoveryJob` (PENDING), enqueue BullMQ, 202
- `GET /api/projects/:id/discovery/status` — ultimo job del progetto
- `GET /api/projects/:id/discovery/history` — lista paginata job
Scripts: `npm run worker` (root + apps/web). **Build OK (33 route).**

#### ✅ Step 2b.5 — Discovery Review UI
Tab "Discovery" nella pagina progetto (`?tab=discovery`):
- `start-discovery-dialog.tsx`: form per avviare job (CRAWL_SITE / SEARCH_PLATFORM / FULL_DISCOVERY), selezione piattaforme con checkbox, config crawl opzionale.
- `discovery-job-status.tsx`: card con status corrente, polling ogni 3s se PENDING/RUNNING (usa `GET /status`), mostra `resultSummary` dettagliato; `router.refresh()` al completamento.
- `discovery-review.tsx`: lista DISCOVERED (max 20), approve/reject per item, bulk approve/reject con AlertDialog di conferma; "vedi tutti" link al content tab filtrato.
- Storico job (ultimi 5): tabella tipo/status/date/risultati renderizzata server-side.
- Tab nav URL-driven (`?tab=` param), dati fetchati condizionalmente per tab attivo.
- Header azioni cambiano in base al tab (Discovery: "Avvia Discovery"; Content: "Aggiungi", "CSV").
**Build OK (33 route).**

#### ✅ Step 2b.6 — Phase 2b Polish
**Audit log**: `DISCOVERY_JOB_STARTED`, `DISCOVERY_JOB_COMPLETED`, `DISCOVERY_JOB_FAILED` in `lib/audit.ts`; loggati inline nel worker (usa la sua istanza Prisma dedicata) con metadata jobType + resultSummary/error.
**Worker hardening**: `safeUpdateJob()` wrappa `prisma.discoveryJob.update` — ignora P2025 (record not found); `logAudit()` inline never throws; errori categorizzati (engine down vs errore dati).
**Python retry logic**:
- `agents/search.py`: `_call_brave` con `max_retries=3`, exponential backoff 2^attempt secondi su HTTP 429.
- `agents/crawler.py`: `_fetch_page_with_retry()` wrapper, retry su connection errors e HTTP 5xx (max 2 retry, sleep 1.5s e 3s).
**UI polish**: `StartDiscoveryDialog` accetta `hasActiveJob` prop — bottone disabilitato con spinner "Discovery in corso…" mentre un job è PENDING/RUNNING; `FetchContentButton` (`fetch-content-button.tsx`) — batch-fetcha rawContent per items con URL ma senza rawContent, mostra conteggio e risultato inline; wired nella tab Discovery del progetto.
**Build OK (33 route).**

---

## 🎉 Fase 2 — Content Discovery COMPLETATA

---

# Piano Dettagliato — Fase 3: Knowledge Graph & Analysis

## Decisioni Architetturali Fase 3

### ADR-009: Embedding Model — fastembed (ONNX locale)
- Libreria: `fastembed` (ONNX runtime, ~200 MB vs ~1 GB PyTorch)
- Modello: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384 dim, multilingua it/en)
- Lazy loading, singleton nel processo FastAPI
- Nessun costo per request; supporto italiano nativo
- Upgrade opzionale a OpenAI `text-embedding-3-small` via env `EMBEDDING_PROVIDER=openai` (richiede `OPENAI_API_KEY`)
- Colonna pgvector: `vector(384)` su `content_items`; indice HNSW per ANN search

### ADR-010: Entity Extraction via Claude Haiku
- Modello: `claude-haiku-4-5-20251001` — rapido e economico per task strutturati
- Output: JSON list `[{label, type, salience, context}]` via structured tool use
- Batch: fino a 10 content items per chiamata (bilanciamento token/latenza)
- EntityType: BRAND, PERSON, ORGANIZATION, TOPIC, PRODUCT, LOCATION, CONCEPT, OTHER
- Normalizzazione: lowercase + strip + dedup per `(projectId, normalizedLabel, type)`
- `frequency` sull'Entity: incrementato ad ogni menzione trovata in un nuovo content item

### ADR-011: AI Readiness Score — calcolo in Next.js + suggestions via Haiku
- Dimensioni e pesi (score 0-100 su ciascuna):
  - **Copertura** (25%): piattaforme uniche (max 6 → 100), rapporto sorgenti esterne vs proprie
  - **Profondità** (25%): word count medio (target 800+ = 100), % contenuti con rawContent estratto
  - **Freschezza** (20%): % contenuti < 6 mesi (peso 1.0), < 12 mesi (peso 0.5), oltre (peso 0)
  - **Autorevolezza** (15%): media pesi piattaforma (NEWS=100, SUBSTACK/LINKEDIN=80, MEDIUM=70, WEBSITE=60, TWITTER=40, altri=30)
  - **Coerenza** (15%): % delle top-3 entità per frequenza che compaiono in ≥40% dei contenuti APPROVED
- Overall: media pesata delle 5 dimensioni
- Suggestions: 3-5 azioni concrete generate da Claude Haiku sulle dimensioni più basse (threshold < 60)
- Calcolo pure SQL/Prisma in Next.js — nessun roundtrip engine; solo le suggestions usano l'LLM

---

## Schema Database — Fase 3

```prisma
// Aggiunta a ContentItem esistente
model ContentItem {
  // ... campi esistenti ...
  embedding       Unsupported("vector(384)")?  // testo embedding
  contentEntities ContentEntity[]
}

// Aggiunta a Project esistente
model Project {
  // ... relazioni esistenti ...
  entities     Entity[]
  score        ProjectScore?
  analysisJobs AnalysisJob[]
}

enum EntityType {
  BRAND
  PERSON
  ORGANIZATION
  TOPIC
  PRODUCT
  LOCATION
  CONCEPT
  OTHER
}

model Entity {
  id              String     @id @default(uuid())
  projectId       String     @map("project_id")
  type            EntityType
  label           String     @db.VarChar(255)
  normalizedLabel String     @map("normalized_label") @db.VarChar(255)
  frequency       Int        @default(1)   // # content items dove appare
  metadata        Json?      @db.JsonB
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")

  project         Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  contentEntities ContentEntity[]
  sourceRelations EntityRelation[] @relation("SourceEntity")
  targetRelations EntityRelation[] @relation("TargetEntity")

  @@unique([projectId, normalizedLabel, type])
  @@index([projectId, type])
  @@map("entities")
}

model ContentEntity {
  contentId String  @map("content_id")
  entityId  String  @map("entity_id")
  salience  Float   @default(0.5)  // 0-1: rilevanza dell'entità nel contenuto
  context   String? @db.Text        // snippet testuale intorno all'entità

  content ContentItem @relation(fields: [contentId], references: [id], onDelete: Cascade)
  entity  Entity      @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@id([contentId, entityId])
  @@map("content_entities")
}

model EntityRelation {
  id           String   @id @default(uuid())
  projectId    String   @map("project_id")
  sourceId     String   @map("source_id")
  targetId     String   @map("target_id")
  relationType String   @map("relation_type") @db.VarChar(100)
  weight       Float    @default(1.0)
  createdAt    DateTime @default(now()) @map("created_at")

  source Entity @relation("SourceEntity", fields: [sourceId], references: [id], onDelete: Cascade)
  target Entity @relation("TargetEntity", fields: [targetId], references: [id], onDelete: Cascade)

  @@unique([sourceId, targetId, relationType])
  @@index([projectId])
  @@map("entity_relations")
}

model ProjectScore {
  id           String   @id @default(uuid())
  projectId    String   @unique @map("project_id")
  overallScore Float    @map("overall_score")         // 0-100
  dimensions   Json     @db.JsonB                      // {copertura, profondita, freschezza, autorita, coerenza}
  suggestions  Json?    @db.JsonB                      // string[]
  contentCount Int      @map("content_count")          // # contenuti usati per il calcolo
  isStale      Boolean  @default(false) @map("is_stale") // true dopo nuovi contenuti
  computedAt   DateTime @map("computed_at")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("project_scores")
}

enum AnalysisJobType {
  FULL_ANALYSIS        // extract + embed + cluster + score (sequenziale)
  EXTRACT_ENTITIES
  GENERATE_EMBEDDINGS
  CLUSTER_TOPICS
  COMPUTE_SCORE
}

model AnalysisJob {
  id            String          @id @default(uuid())
  projectId     String          @map("project_id")
  jobType       AnalysisJobType
  status        JobStatus       @default(PENDING)  // riusa enum esistente
  resultSummary Json?           @map("result_summary") @db.JsonB
  startedAt     DateTime?       @map("started_at")
  completedAt   DateTime?       @map("completed_at")
  errorMessage  String?         @map("error_message") @db.Text
  createdAt     DateTime        @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, status])
  @@map("analysis_jobs")
}
```

---

## API Design — Fase 3

### Python Engine (nuovi endpoint)
```
POST /api/extract/entities   → [{contentId, entities: [{label,type,salience,context}]}]
POST /api/embed/batch        → [{id, embedding: float[384]}]
POST /api/analyze/topics     → [{contentId, topicIdx, topicLabel, confidence}]
POST /api/analyze/suggestions → string[]   (input: {dimensions, projectName})
```

### Next.js API (nuove route)
```
POST /api/projects/:id/analysis/start    → avvia FULL_ANALYSIS (202)
GET  /api/projects/:id/analysis/status   → ultimo AnalysisJob
GET  /api/projects/:id/analysis/score    → ProjectScore con dimensioni
POST /api/projects/:id/analysis/score    → ricalcola e salva score
GET  /api/projects/:id/analysis/entities → lista Entity (filtro type, paginata)
GET  /api/projects/:id/analysis/topics   → Entity di tipo TOPIC con content count
```

### BullMQ — nuovi job type (in `workers/discovery.ts` o nuovo `workers/analysis.ts`)
```
FULL_ANALYSIS       → chiama in sequenza: EXTRACT → EMBED → CLUSTER → SCORE
EXTRACT_ENTITIES    → batch extraction con Claude Haiku
GENERATE_EMBEDDINGS → batch embedding con fastembed
CLUSTER_TOPICS      → clustering KMeans + label LLM
COMPUTE_SCORE       → calcolo score + suggestions LLM
```

---

## Piano Step Atomici — Fase 3

### Step 3.0 — Schema & Infrastructure ✅
- [x] Abilitare pgvector: `CREATE EXTENSION IF NOT EXISTS vector` (migration SQL raw)
- [x] Aggiungere `embedding Unsupported("vector(384)")?` a `ContentItem`
- [x] Nuovi enum: `EntityType`, `AnalysisJobType`
- [x] Nuovi modelli: `Entity`, `ContentEntity`, `EntityRelation`, `ProjectScore`, `AnalysisJob`
- [x] Aggiungere relazioni a `Project` e `ContentItem`
- [x] Migration: `add-knowledge-graph`
- [x] Indice HNSW pgvector: `CREATE INDEX ON content_items USING hnsw (embedding vector_cosine_ops)` (in migration SQL)
- [x] Prisma generate + verifica build
- **Note**: `Unsupported("vector(384)")` escluso dal Prisma CRUD automatico — operazioni embedding via `$executeRaw`/`$queryRaw`
- **Note**: pgvector deve essere abilitato prima di `migrate deploy` — usare `migration.sql` con SQL raw
- **Done when**: migration applicata, `prisma generate` OK, build OK ✅

### Step 3.1 — Entity Extraction Pipeline ✅
- [x] `agents/extractor.py`: `EntityExtractorAgent`
  - Client Anthropic asincrono, `claude-haiku-4-5-20251001`
  - Tool use / JSON structured output: schema `{entities: [{label, type, salience, context}]}`
  - Batch: 1 chiamata LLM per content item (semplicità > throughput per MVP)
  - Retry su `APIStatusError` 429/529 con exponential backoff
  - Normalizzazione: `label.strip().lower()`, type uppercase
- [x] `api/extract.py`: `POST /api/extract/entities` — body `[{id, text, title}]`, response `[{id, entities}]`
- [x] `requirements.txt`: nessuna dipendenza aggiuntiva (anthropic già presente)
- [x] BullMQ: aggiungere `EXTRACT_ENTITIES` al worker (secondo Worker su queue "analysis")
  - Fetch content items con `rawContent IS NOT NULL AND status = APPROVED` (max 50)
  - Per ogni item: chiama engine, upsert `Entity` (increment frequency se esiste), create `ContentEntity`
  - `resultSummary`: `{processed, entitiesFound, errors}`
- [x] Next.js: `POST /api/projects/:id/analysis/extract` → crea `AnalysisJob` + enqueue
- [x] `GET /api/projects/:id/analysis/status` → ultimo AnalysisJob del progetto
- [x] Audit: `ANALYSIS_JOB_STARTED`, `ANALYSIS_JOB_COMPLETED`, `ANALYSIS_JOB_FAILED` in `lib/audit.ts`
- **Done when**: content items APPROVED hanno Entity estratte, ContentEntity presenti nel DB ✅

### Step 3.2 — Embedding Generation ✅
- [x] `agents/embedder.py`: `EmbedderAgent`
  - `fastembed.TextEmbedding("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")`
  - Singleton con lazy loading (`_model: TextEmbedding | None = None`)
  - Input: `[{id, text}]`; testo = `title + ". " + rawContent[:2000]`
  - Output: `[{id, embedding: list[float]}]`
  - Batch interno: `model.embed(texts, batch_size=32)`
- [x] `api/embed.py`: `POST /api/embed/batch` — body `[{id, text}]`, response `[{id, embedding}]`
- [x] `requirements.txt`: aggiungi `fastembed==0.4.2`
- [x] BullMQ: aggiungere `GENERATE_EMBEDDINGS` al worker
  - Fetch content items con `rawContent IS NOT NULL` ma `embedding IS NULL` (`$queryRawUnsafe`)
  - Batch da 100 alla volta verso engine
  - Update via `prisma.$executeRawUnsafe`: `UPDATE content_items SET embedding = $1::vector WHERE id = $2`
  - `resultSummary`: `{processed, errors}`
- [x] Next.js: `POST /api/projects/:id/analysis/embed` → crea `AnalysisJob` + enqueue
- [x] Rebuild Docker image (fastembed aggiunto), volume `fastembed_models` per persistenza modello ONNX
- **Note**: `fastembed` scarica il modello ONNX al primo avvio (~90 MB); volume Docker `fastembed_models:/app/models`
- **Note**: Prisma esclude i campi `Unsupported` dai tipi generati → tutte le operazioni embedding via `$queryRawUnsafe`/`$executeRawUnsafe`
- **Done when**: content items con rawContent hanno vettore embedding; similarity query via `$queryRaw` funziona ✅

### Step 3.3 — Topic Clustering
- [ ] `agents/clusterer.py`: `TopicClusterer`
  - Input: `[{id, embedding: list[float]}]`
  - `k = max(3, min(12, round(sqrt(n / 2))))` dove n = numero content items
  - KMeans da `scikit-learn` (n_init=10, random_state=42)
  - Silhouette score per validare k (se < 0.15: ridurre k o restituire cluster singolo)
  - Label cluster: Claude Haiku — prompt con 5 titoli sample per cluster → label 2-4 parole in italiano
  - Output: `[{id, clusterIdx, topicLabel, confidence}]`; confidence = distanza inversa dal centroide normalizzata
- [ ] `api/analyze.py`: `POST /api/analyze/topics`
- [ ] `requirements.txt`: aggiungi `scikit-learn==1.6.1`
- [ ] BullMQ: aggiungere `CLUSTER_TOPICS` al worker
  - Fetch embeddings via `$queryRaw`: `SELECT id, embedding::text FROM content_items WHERE project_id=$1 AND embedding IS NOT NULL`
  - Parse vettori da stringa pgvector `[x,y,z]`
  - Rimuovi Entity TOPIC esistenti del progetto
  - Crea Entity (type=TOPIC) per ogni label unica
  - Crea ContentEntity per ogni assegnazione
  - `resultSummary`: `{clustersFound, itemsClustered, errors}`
- [ ] Next.js: `POST /api/projects/:id/analysis/cluster` → enqueue `CLUSTER_TOPICS`
- [ ] Prerequisito: step 3.2 completato (embedding presenti)
- **Note**: min 6 content items con embedding per clustering sensato; se meno, skip con warning
- **Done when**: Entity TOPIC presenti, ContentEntity con topic assegnati

### Step 3.4 — AI Readiness Scoring
- [ ] `lib/scoring.ts`: calcolo dimensioni in Next.js con Prisma
  - `computeScoreDimensions(projectId)` → `{copertura, profondita, freschezza, autorita, coerenza}`
  - Query aggregate in parallelo (Promise.all)
  - Formula per ogni dimensione descritta in ADR-011
- [ ] `lib/suggestions.ts`: genera suggestions via Claude Haiku
  - Chiama Python engine `POST /api/analyze/suggestions` con dimensioni basse
  - Fallback: suggestions statiche hard-coded se engine non disponibile
- [ ] `api/analyze.py` engine: `POST /api/analyze/suggestions` — riceve dimensions + projectName, ritorna `string[]`
- [ ] BullMQ: aggiungere `COMPUTE_SCORE` al worker
  - Chiama `computeScoreDimensions` + `generateSuggestions`
  - Upsert `ProjectScore` (create or update by projectId)
  - Imposta `isStale = false`
- [ ] Next.js:
  - `GET /api/projects/:id/analysis/score` → ritorna `ProjectScore` o `null`
  - `POST /api/projects/:id/analysis/score` → enqueue `COMPUTE_SCORE`, ritorna 202
- [ ] Audit: `ANALYSIS_SCORE_COMPUTED`
- [ ] Stale flag: dopo `PATCH /content/bulk` con status change o nuovo contenuto aggiunto → `isStale = true`
- **Done when**: ProjectScore calcolato e recuperabile, suggestions generate

### Step 3.5 — Analysis Dashboard UI
- [ ] Tab "Analisi" nella pagina progetto (terzo tab, URL param `?tab=analysis`)
- [ ] `analysis-job-status.tsx`: polling ogni 4s su `GET /analysis/status` mentre PENDING/RUNNING
- [ ] `score-card.tsx`:
  - Score globale: numero grande + colore (< 40 rosso, 40-70 giallo, > 70 verde)
  - 5 barre dimensione: label + valore + `<Progress>` shadcn
  - Badge "Score non aggiornato" se `isStale = true`
  - Bottone "Avvia Analisi" → POST `/analysis/start`
  - Data ultimo calcolo
  - Lista suggestions (icona ⚠ + testo)
- [ ] `entities-panel.tsx`:
  - Tabs per tipo: TUTTI / BRAND / PERSON / ORG / PRODUCT / LOCATION
  - Lista con label, badge tipo, contatore frequenza
  - Paginazione (20 per pagina)
  - GET `/analysis/entities?type=PERSON&page=1`
- [ ] `topics-panel.tsx`:
  - Lista topic (Entity di tipo TOPIC) con content count
  - Titoli sample (max 3) per topic
  - GET `/analysis/topics`
- [ ] `content-health-card.tsx`:
  - % contenuti con rawContent estratto
  - Word count medio
  - % per status (barre colorate)
  - Calcolato server-side nella page
- [ ] Stato vuoto: "Nessuna analisi eseguita — clicca Avvia Analisi"
- [ ] Dati caricati server-side condizionalmente se `?tab=analysis` (stesso pattern Discovery)
- **Done when**: tab Analisi navigabile, score + entities + topics visibili, bottone avvia funziona

### Step 3.6 — Phase 3 Polish
- [ ] `FULL_ANALYSIS` orchestration: EXTRACT → EMBED → CLUSTER → SCORE in sequenza nel worker
  - Ogni step aggiorna `resultSummary` progressivamente
  - Se EXTRACT fallisce → abort; se CLUSTER fallisce → prosegui con SCORE parziale
  - Skip CLUSTER se < 6 items con embedding
- [ ] `workers/analysis.ts` (o integrazione nel worker esistente): separare il worker se il file cresce troppo
- [ ] Audit: `ANALYSIS_JOB_STARTED`, `ANALYSIS_JOB_COMPLETED`, `ANALYSIS_JOB_FAILED`
- [ ] Docker: volume per fastembed model cache (`/root/.cache/huggingface/`)
- [ ] Performance: `SELECT embedding` pesante — aggiungere `@@index([projectId])` su `content_items` per embedding queries
- [ ] Edge cases:
  - 0 contenuti APPROVED → score = 0 su tutte le dimensioni + suggestion dedicata
  - rawContent mancante su tutti → embedding/clustering skippati, score penalizzato
  - Progetto senza nome brand nel domain → coerenza non calcolabile (flag nel score)
- [ ] Invalidazione score: hook in API content PATCH + bulk → `ProjectScore.isStale = true`
- [ ] `requirements.txt`: lock versions (fastembed 0.4.2, scikit-learn 1.6.1)
- **Done when**: FULL_ANALYSIS robusto, edge cases gestiti, UX coerente con Fasi 1-2

---

## Fasi Future (Overview)

| Fase | Contenuto |
|------|-----------|
| 3 | Knowledge Graph: entity extraction, topic clustering, embeddings (pgvector), AI Readiness scoring |
| 4 | Dashboard: graph visualization (react-force-graph), gap analysis, competitor benchmark |
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
| 009 | Embeddings: **fastembed** (ONNX, ~200 MB), modello multilingual-MiniLM-L12-v2 384 dim |
| 010 | Entity extraction: **Claude Haiku** con structured tool use, batch 1 item/chiamata |
| 011 | AI Readiness Score: 5 dimensioni calcolate in Next.js SQL; suggestions via Claude Haiku |

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
