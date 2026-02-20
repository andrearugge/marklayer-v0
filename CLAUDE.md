# CLAUDE.md — AI Visibility Platform

> Questo file è il punto di riferimento per Claude Code. Contiene lo stato corrente del progetto, le convenzioni, e il piano di sviluppo step-by-step.

## Stato Corrente del Progetto

**Fase**: 2 — Content Discovery
**Step corrente**: 2.5 completato
**Ultimo commit**: feat(content): step 2.5 — Content Detail & Edit
**Data ultimo aggiornamento**: 2026-02-18

---

## Stack Tecnologico

| Layer | Tecnologia | Note |
|-------|-----------|------|
| Frontend | Next.js 14+ (App Router) | SSR, API Routes, Middleware |
| UI Components | shadcn/ui + Tailwind CSS | Radix UI primitives |
| ORM | Prisma | Schema declarativo, migrations auto |
| Database | PostgreSQL 16 | Con estensione pgvector |
| Knowledge Graph | PostgreSQL (tabelle nodi/edges) | Migrazione a Neo4j post-MVP se necessario |
| Auth | NextAuth.js v5 (Auth.js) | Google OAuth + Credentials |
| Job Queue | BullMQ + Redis | Task asincroni |
| AI Service | Python FastAPI | Crawling, NLP, embeddings, LLM |
| LLM | Claude API (Anthropic) | Adapter pattern per multi-provider |
| Container | Docker Compose | Dev locale; deployment deciso dopo |

## Struttura del Progetto

```
ai-visibility-platform/
├── apps/
│   └── web/                          # Next.js app
│       ├── app/                      # App Router
│       │   ├── (auth)/               # Route group: login, register
│       │   │   ├── login/
│       │   │   └── register/
│       │   ├── (dashboard)/          # Route group: app autenticata
│       │   │   ├── layout.tsx        # Dashboard layout con sidebar
│       │   │   ├── projects/
│       │   │   ├── content/
│       │   │   ├── graph/
│       │   │   └── settings/
│       │   ├── admin/                # Admin panel
│       │   │   ├── layout.tsx
│       │   │   └── users/
│       │   ├── api/                  # API routes
│       │   │   ├── auth/             # NextAuth routes
│       │   │   ├── admin/
│       │   │   ├── me/
│       │   │   └── projects/
│       │   ├── layout.tsx            # Root layout
│       │   └── page.tsx              # Landing page
│       ├── components/
│       │   ├── ui/                   # shadcn/ui components
│       │   ├── auth/                 # Auth-specific components
│       │   ├── dashboard/            # Dashboard components
│       │   ├── admin/                # Admin components
│       │   └── shared/               # Shared/common components
│       ├── lib/
│       │   ├── auth.ts               # NextAuth config
│       │   ├── prisma.ts             # Prisma client singleton
│       │   ├── utils.ts              # Utility functions
│       │   └── validations/          # Zod schemas
│       ├── prisma/
│       │   ├── schema.prisma         # Database schema
│       │   └── seed.ts               # Seed data
│       ├── public/
│       ├── styles/
│       │   └── globals.css
│       ├── types/
│       │   └── index.ts              # Shared TypeScript types
│       ├── middleware.ts              # Auth + role middleware
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
├── services/
│   └── engine/                       # Python FastAPI (Fase 2+)
│       ├── api/
│       ├── agents/
│       ├── graph/
│       ├── embeddings/
│       ├── workers/
│       ├── requirements.txt
│       └── Dockerfile
├── docs/
│   └── adr/                          # Architecture Decision Records
│       ├── 001-stack-selection.md
│       ├── 002-orm-prisma.md
│       ├── 003-knowledge-graph-postgres.md
│       └── 004-docker-compose-dev.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── CLAUDE.md                         # ← Questo file
├── README.md
└── CHANGELOG.md
```

## Convenzioni

### Git & Commit
- **Branch strategy**: `main` + feature branches (`feat/step-XX-description`)
- **Commit format**: `type(scope): description`
  - Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`
  - Scope: `auth`, `admin`, `ui`, `db`, `api`, `config`, `docker`
  - Esempio: `feat(auth): add Google OAuth with NextAuth v5`
- **Un commit = una unità logica di lavoro**. Mai multi-feature nello stesso commit.

### Codice
- **TypeScript strict mode** ovunque nel frontend
- **Zod** per validazione input (API routes e form)
- **Server Components** di default; Client Components solo quando necessario (interattività, hooks)
- **Naming**:
  - File/cartelle: `kebab-case`
  - Componenti React: `PascalCase`
  - Funzioni/variabili: `camelCase`
  - Costanti: `UPPER_SNAKE_CASE`
  - Tipi/Interfacce: `PascalCase` (prefix `I` non usato)
- **Import order**: (1) react/next, (2) librerie esterne, (3) componenti interni, (4) utils/types, (5) styles
- **Error handling**: try/catch espliciti nelle API routes, error boundaries nei componenti

### Database
- **Naming tabelle**: `snake_case`, plurale (`users`, `content_items`)
- **Naming colonne**: `snake_case`
- **Timestamps**: sempre `created_at` e `updated_at` con `@default(now())` e `@updatedAt`
- **Soft delete**: colonna `deleted_at` nullable dove necessario
- **UUID v4** come primary key ovunque

### API
- **RESTful** con naming coerente
- **Risposte**: `{ data: T }` per successo, `{ error: { message: string, code: string } }` per errori
- **Status codes**: 200 (ok), 201 (created), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error)
- **Paginazione**: cursor-based con `{ data: T[], nextCursor?: string, hasMore: boolean }`

### UI
- **shadcn/ui** come base, personalizzato dove serve
- **Responsive**: mobile-first
- **Loading states**: skeleton loaders, non spinner globali
- **Toast notifications** per feedback azioni utente

---

## Piano di Sviluppo — Fase 1: Foundation

### Step 1.0 — Project Scaffolding ✅
- [x] Init repo git
- [x] Setup Next.js 16 con App Router e TypeScript (strict mode)
- [x] Configurazione Tailwind CSS v4
- [x] Init shadcn/ui (Button component aggiunto)
- [x] Struttura cartelle come da schema sopra (con src/ directory)
- [x] `.env.example` con variabili placeholder
- [x] `.gitignore` completo
- [x] ADR docs creati (001–004)
- **Note**: Next.js 16 depreca `middleware.ts` a favore di `proxy.ts` — aggiornare in Step 1.4
- **Note**: root `package.json` con npm workspaces — `npm run dev` dalla root delega a `apps/web`
- **Done when**: `npm run dev` funziona, pagina base visibile, shadcn Button renderizza ✅

### Step 1.1 — Docker Compose & Database ✅
- [x] `docker-compose.yml` con PostgreSQL 16 (pgvector/pgvector:pg16) e Redis 7
- [x] Configurazione Prisma 7 con `prisma.config.ts` (datasource.url + PrismaPg adapter)
- [x] Schema Prisma iniziale: modello `User` con role/status enum, UUID PK, timestamps
- [x] Prima migration (`init`) applicata con successo
- [x] Script seed con admin user (`admin@example.com`, role: admin)
- [x] Prisma client singleton in `lib/prisma.ts` con PrismaPg adapter
- **Note Prisma 7**: `url` rimosso da `schema.prisma` → `prisma.config.ts` con `datasource.url`
- **Note Prisma 7**: adapter esportato come `PrismaPg` (non `PrismaPostgres`)
- **Note Prisma 7**: seed e client richiedono entrambi il driver adapter esplicito
- **Done when**: `docker compose up`, `npx prisma migrate dev`, seed funziona, query test OK ✅

### Step 1.2 — Authentication Setup ✅
- [x] Installazione NextAuth.js v5 (5.0.0-beta.30)
- [x] Provider Google OAuth
- [x] Provider Credentials (email/password) con bcrypt
- [x] PrismaAdapter per NextAuth (`@auth/prisma-adapter@2.11.1`)
- [x] Schema Prisma aggiornato: Account, Session, VerificationToken + campo password su User
- [x] role e status su User già presenti da Step 1.1
- [x] Type augmentation in `types/next-auth.d.ts` (Session + JWT, non User/AdapterUser)
- [x] Variabili .env: AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- [x] Rimosso package-lock.json annidato, turbopack.root configurato
- **Note NextAuth v5**: adapter castato `as any` per conflitto `@auth/core@0.41.0` vs `0.41.1`
- **Note NextAuth v5**: augmentare solo `Session` e `JWT`, non `User` (evita conflitto AdapterUser)
- **Done when**: build OK, `/api/auth/[...nextauth]` riconosciuta come route dinamica ✅

### Step 1.3 — Auth UI Pages ✅
- [x] Layout per route group `(auth)` — centrato, max-w-sm
- [x] Pagina `/login` con form email/password + bottone Google OAuth
- [x] Pagina `/register` con form (nome, email, password, conferma)
- [x] Redirect post-login/register a `/projects` (primo slug dashboard)
- [x] Gestione errori: `CredentialsSignin`, `OAuthAccountNotLinked`, email già esistente
- [x] Componente `UserButton` — Avatar + DropdownMenu (profilo, sign out)
- [x] `SessionProvider` wrapper nel root layout
- [x] API route `POST /api/auth/register` con Zod + bcrypt + upsert check
- [x] Validazioni Zod in `lib/validations/auth.ts`
- **Note**: Redirect a `/projects` (non `/dashboard`) per evitare conflitto route group `(dashboard)/page.tsx`
- **Done when**: Flow completo login/register/logout funzionante via UI ✅

### Step 1.4 — Middleware & Route Protection ✅
- [x] `src/proxy.ts` (Next.js 16 — rinominato da middleware.ts)
- [x] Route `/projects`, `/content`, `/graph`, `/settings` → redirect `/login?callbackUrl=` se non autenticato
- [x] Route `/admin/*` → redirect `/login` se non autenticato, redirect `/projects` se non admin
- [x] Route `/login`, `/register` → redirect `/projects` se già loggato
- [x] `getCurrentUser()` in `lib/auth.ts` — chiama `auth()` per Server Components e API routes
- [x] Pagine placeholder `/projects` e `/admin` create
- **Note Next.js 16**: file si chiama `proxy.ts`, funzione `proxy`, export default — stessa API di middleware
- **Note**: `auth(handler)` di NextAuth v5 inietta `req.auth` (sessione) — usare come wrapper del proxy
- **Done when**: Build mostra `ƒ Proxy (Middleware)`, redirect funzionanti ✅

### Step 1.5 — Dashboard Layout Shell ✅
- [x] Layout dashboard con sidebar navigazione
- [x] Sidebar responsive (hidden su mobile, Sheet-based mobile nav)
- [x] Header sticky con UserButton e breadcrumbs
- [x] Pagina `/dashboard` (dashboard home)
- [x] Navigazione: Dashboard, Projects, Content, Graph, Settings
- [x] Breadcrumbs dinamici da `usePathname()`
- [x] `TooltipProvider` nel root layout, shadcn sheet/scroll-area/tooltip installati
- [x] Redirect post-login/register aggiornati a `/dashboard`
- [x] proxy.ts aggiornato: `/dashboard` in PROTECTED_PREFIXES, redirect target `/dashboard`
- **Note**: Sidebar usa `hidden lg:flex`; MobileNav usa `lg:hidden` con Sheet
- **Done when**: Build OK (13 route), Proxy Middleware presente, TypeScript 0 errori ✅

### Step 1.6 — Admin Panel: User Management ✅
- [x] Layout admin separato (reusa Sidebar + Header del dashboard)
- [x] Sidebar aggiornata: sezione "Admin" con link Users visibile solo ad admin
- [x] Pagina `/admin/users` con DataTable (@tanstack/react-table + shadcn Table)
- [x] Colonne: Utente (avatar+nome+email), Ruolo (badge), Status (badge), Registrato, Azioni
- [x] Filtri: ricerca testuale (nome/email), select ruolo, select status — URL search params
- [x] Paginazione server-side con prev/next e indicatore pagina/totale
- [x] Azioni: promuovi/rimuovi admin, sospendi/riattiva (AlertDialog di conferma)
- [x] API `GET /api/admin/users` con filtri, ricerca, paginazione
- [x] API `PATCH /api/admin/users/:id` con blocco self-modify
- [x] Validazione Zod in `lib/validations/admin.ts`
- [x] shadcn: table, select, badge, dialog, alert-dialog installati
- **Note**: Query Prisma diretta nel Server Component page (più efficiente che chiamare l'API)
- **Done when**: Build OK (15 route), admin vede/filtra utenti, può cambiare ruoli e status ✅

### Step 1.7 — User Profile & Settings ✅
- [x] `/settings` → redirect a `/settings/profile`
- [x] Pagina `/settings/profile` con form nome + URL avatar (preview live dell'avatar)
- [x] Sidebar destra: info account (email, data registrazione) + provider collegati
- [x] `GET /api/me` — profilo corrente + providers calcolati (Google, credentials)
- [x] `PATCH /api/me` — aggiornamento nome e immagine con Zod
- [x] `useSession().update()` dopo salvataggio per aggiornare UserButton in tempo reale
- [x] jwt callback aggiornato: refresh di name/image da DB su trigger "update"
- **Done when**: Build OK (17 route), utente può modificare profilo, UserButton si aggiorna ✅

### Step 1.8 — Audit Log System ✅
- [x] Modello Prisma `AuditLog` (id, action, actorId/Email, targetId/Email, metadata JSON, createdAt + indici)
- [x] Migration `add-audit-log` applicata
- [x] `lib/audit.ts`: `logAuditEvent()` helper + `AUDIT_ACTIONS` constants — never throws
- [x] Log automatico `user.login` via NextAuth `events.signIn`
- [x] Log automatico `user.created` in `POST /api/auth/register`
- [x] Log automatico `user.role_changed` / `user.status_changed` in `PATCH /api/admin/users/:id` con metadata {old, new}
- [x] `GET /api/admin/audit-logs` con filtro per action + paginazione
- [x] Pagina `/admin/audit-log`: tabella Evento/Attore/Target/Dettagli/Data + filtro + paginazione
- [x] Sidebar Admin aggiornata: aggiunto link "Audit Log" con icona ClipboardList
- **Note**: Prisma `Json` field richiede cast a `Prisma.InputJsonValue`; `prisma generate` necessario dopo migration
- **Done when**: Build OK (19 route), login/register/cambio ruolo vengono loggati ✅

### Step 1.9 — Foundation Polish ✅
- [x] `app/error.tsx` — root error boundary (500, Client Component)
- [x] `app/(dashboard)/error.tsx` — error boundary per sezione dashboard
- [x] `app/admin/error.tsx` — error boundary per sezione admin
- [x] `app/not-found.tsx` — pagina 404 custom con link a dashboard
- [x] Loading skeleton per `/dashboard`, `/settings/profile`, `/admin/users`, `/admin/audit-log`
- [x] Toast notifications (sonner) installato: `<Toaster richColors>` nel root layout
- [x] `ProfileForm`: success toast, errori rimangono inline (Alert)
- [x] `UserRowActions`: toast su successo (promozione/rimozione/sospensione/riattivazione) e su errore
- **Done when**: Build OK (19 route), skeleton/error/404 presenti, toast operativi ✅

---

## 🎉 Fase 1 — Foundation COMPLETATA

---

# Piano Dettagliato — Fase 2: Content Discovery
## Decisioni Architetturali Fase 2

### ADR-005: Fase 2 Split — CRUD first, FastAPI dopo
- **2a**: Modelli DB, CRUD Projects, Content manual add/import, UI gestione contenuti → tutto in Next.js
- **2b**: Python FastAPI service, Discovery Agent (crawling, platform search), review UI
- **Motivazione**: base solida e testabile prima di aggiungere complessità infrastrutturale

### ADR-006: Web Crawling — Librerie proprie
- **Node.js (Fase 2b)**: Cheerio (HTML parsing statico) + Puppeteer (rendering JS, SPA)
- **Python (futuro)**: BeautifulSoup + Playwright come alternativa
- **Motivazione**: controllo completo, nessun costo per request, nessun vendor lock-in
- **Nota**: Puppeteer in Docker richiede configurazione Chromium headless

### ADR-007: Platform Discovery — Google Search
- Ricerca contenuti su tutte le piattaforme via `site:platform.com "nome autore"` o query equivalenti
- Un solo meccanismo invece di N integrazioni API
- Opzioni di implementazione:
  - Google Custom Search JSON API (100 query/giorno gratis, poi $5/1000 query)
  - SerpAPI o simili (più costoso ma più affidabile)
  - Scraping diretto dei risultati Google (fragile, rischio ban)
- **Decisione rimandata a Step 2b.2**: per ora ci focalizziamo sul CRUD manuale

---

## Schema Database — Fase 2

### Nuovi modelli Prisma

```prisma
// === PROJECTS ===

model Project {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  name        String   @db.VarChar(255)
  description String?  @db.Text
  domain      String?  @db.VarChar(255)  // sito web principale
  status      ProjectStatus @default(ACTIVE)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  contentItems  ContentItem[]
  discoveryJobs DiscoveryJob[]

  @@map("projects")
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
}

// === CONTENT ITEMS ===

model ContentItem {
  id              String          @id @default(uuid()) @db.Uuid
  projectId       String          @map("project_id") @db.Uuid
  url             String?         @db.Text
  sourcePlatform  SourcePlatform
  contentType     ContentType
  title           String          @db.VarChar(500)
  rawContent      String?         @db.Text         // contenuto estratto
  excerpt         String?         @db.VarChar(1000) // anteprima breve
  contentHash     String?         @map("content_hash") @db.VarChar(64) // SHA-256 per dedup
  discoveryMethod DiscoveryMethod
  status          ContentStatus   @default(DISCOVERED)
  wordCount       Int?            @map("word_count")
  language        String?         @db.VarChar(10)   // es. "it", "en"
  publishedAt     DateTime?       @map("published_at")
  lastCrawledAt   DateTime?       @map("last_crawled_at")
  metadata        Json?           @db.JsonB         // dati piattaforma-specifici
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, contentHash])  // no duplicati nello stesso progetto
  @@index([projectId, sourcePlatform])
  @@index([projectId, status])
  @@index([projectId, contentType])
  @@map("content_items")
}

enum SourcePlatform {
  WEBSITE
  SUBSTACK
  MEDIUM
  LINKEDIN
  REDDIT
  QUORA
  YOUTUBE
  TWITTER
  NEWS        // testate giornalistiche
  OTHER
}

enum ContentType {
  ARTICLE
  BLOG_POST
  PAGE          // pagina statica (about, servizi, etc.)
  SOCIAL_POST
  COMMENT
  MENTION       // menzione su fonte esterna
  VIDEO
  PODCAST
  OTHER
}

enum DiscoveryMethod {
  MANUAL        // aggiunto a mano dall'utente
  CSV_IMPORT    // importato da CSV
  AGENT_CRAWL   // trovato dal crawler
  AGENT_SEARCH  // trovato tramite ricerca
}

enum ContentStatus {
  DISCOVERED    // trovato dall'agent, in attesa di review
  APPROVED      // confermato dall'utente
  REJECTED      // scartato dall'utente
  ARCHIVED      // archiviato
}

// === DISCOVERY JOBS (Fase 2b) ===

model DiscoveryJob {
  id            String         @id @default(uuid()) @db.Uuid
  projectId     String         @map("project_id") @db.Uuid
  jobType       DiscoveryJobType
  status        JobStatus      @default(PENDING)
  config        Json?          @db.JsonB  // parametri del job
  resultSummary Json?          @map("result_summary") @db.JsonB // { found, approved, rejected }
  startedAt     DateTime?      @map("started_at")
  completedAt   DateTime?      @map("completed_at")
  errorMessage  String?        @map("error_message") @db.Text
  createdAt     DateTime       @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, status])
  @@map("discovery_jobs")
}

enum DiscoveryJobType {
  CRAWL_SITE
  SEARCH_PLATFORM
  SEARCH_MENTIONS
  FULL_DISCOVERY
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

### Relazione User → Projects

Aggiungere nel modello `User` esistente:
```prisma
model User {
  // ... campi esistenti ...
  projects Project[]
}
```

---

## API Design — Fase 2a

### Projects API

```
POST   /api/projects                    → Crea progetto
GET    /api/projects                    → Lista progetti utente (con conteggio contenuti)
GET    /api/projects/:id                → Dettaglio progetto (con stats)
PATCH  /api/projects/:id                → Aggiorna progetto
DELETE /api/projects/:id                → Soft delete (archive)
```

**POST /api/projects**
```json
// Request
{ "name": "My Brand", "description": "...", "domain": "example.com" }
// Response 201
{ "data": { "id": "uuid", "name": "My Brand", ... } }
```

**GET /api/projects**
```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "name": "My Brand",
      "domain": "example.com",
      "status": "ACTIVE",
      "createdAt": "...",
      "_count": { "contentItems": 42 }
    }
  ]
}
```

### Content Items API

```
POST   /api/projects/:id/content             → Aggiungi singolo contenuto
POST   /api/projects/:id/content/import      → Bulk import da CSV
GET    /api/projects/:id/content             → Lista contenuti (paginata, filtri)
GET    /api/projects/:id/content/:contentId  → Dettaglio contenuto
PATCH  /api/projects/:id/content/:contentId  → Modifica contenuto
DELETE /api/projects/:id/content/:contentId  → Rimuovi contenuto
```

**POST /api/projects/:id/content** (singolo)
```json
// Request
{
  "url": "https://example.com/article",    // opzionale
  "title": "My Article",
  "sourcePlatform": "WEBSITE",
  "contentType": "ARTICLE",
  "rawContent": "...",                     // opzionale, può essere fetched dopo
  "publishedAt": "2024-01-15"             // opzionale
}
// Response 201
{ "data": { "id": "uuid", ... } }
```

**POST /api/projects/:id/content/import** (CSV)
```json
// Request: multipart/form-data con file CSV
// CSV columns: url, title, sourcePlatform, contentType, publishedAt
// Response 200
{ "data": { "imported": 25, "skipped": 3, "errors": [...] } }
```

**GET /api/projects/:id/content**
```
?status=APPROVED&sourcePlatform=WEBSITE&contentType=ARTICLE
&search=keyword&page=1&limit=20
&sortBy=createdAt&sortOrder=desc
```
```json
// Response 200
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

### Validazioni Zod

```typescript
// lib/validations/project.ts
const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  domain: z.string().url().or(z.string().max(0)).optional(),
});

const updateProjectSchema = createProjectSchema.partial();

// lib/validations/content.ts
const createContentSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().min(1).max(500),
  sourcePlatform: z.nativeEnum(SourcePlatform),
  contentType: z.nativeEnum(ContentType),
  rawContent: z.string().optional(),
  excerpt: z.string().max(1000).optional(),
  publishedAt: z.string().datetime().optional(),
});

const updateContentSchema = createContentSchema.partial().extend({
  status: z.nativeEnum(ContentStatus).optional(),
});
```

---

## Piano Step Atomici — Fase 2a (CRUD Manuale)

### Step 2.0 — Database Models & Migration ✅
- [x] Modelli `Project`, `ContentItem`, `DiscoveryJob` aggiunti allo schema Prisma
- [x] Enum: `ProjectStatus`, `SourcePlatform`, `ContentType`, `DiscoveryMethod`, `ContentStatus`, `DiscoveryJobType`, `JobStatus`
- [x] Relazione `User.projects` aggiunta
- [x] Migration `add-projects-and-content` applicata
- [x] Seed aggiornato: progetto "My Brand (Demo)" + 4 content items (WEBSITE/SUBSTACK/MEDIUM/LINKEDIN)
- **Note**: `@db.Uuid` rimosso da tutti i campi UUID per coerenza con schema esistente (`User.id` è `String` plain). Tenuti `@db.VarChar`, `@db.Text`, `@db.JsonB`.
- **Note**: `prisma generate` necessario dopo migrate prima di eseguire il seed
- **Done when**: Migration applicata, seed funziona (4 content items creati) ✅

### Step 2.1 — Projects CRUD API ✅
- [x] `POST /api/projects` — crea progetto per l'utente autenticato → 201
- [x] `GET /api/projects` — lista progetti utente con `_count.contentItems`, ordinati per data desc
- [x] `GET /api/projects/:id` — dettaglio con stats `{ byPlatform, byType, byStatus }` via `groupBy`
- [x] `PATCH /api/projects/:id` — aggiorna name/description/domain (partial update)
- [x] `DELETE /api/projects/:id` — soft delete: set status ARCHIVED (blocca se già ARCHIVED)
- [x] Zod in `lib/validations/project.ts`: `CreateProjectSchema`, `UpdateProjectSchema` (partial)
- [x] `lib/projects.ts`: `assertProjectOwnership()` — ritorna null se non esiste o non è owner (→ 404)
- [x] Audit log: `project.created`, `project.updated`, `project.archived` con metadata
- **Done when**: Build OK (21 route), endpoints presenti, ownership e audit verificati ✅

### Step 2.2 — Projects UI ✅
- [x] Pagina `/projects` — lista progetti come cards (nome, dominio, conteggio contenuti, data creazione)
- [x] Stato empty: messaggio + CTA per creare primo progetto
- [x] Dialog/modal per creare nuovo progetto (nome, descrizione, dominio)
- [x] Pagina `/projects/:id` — overview progetto con stats (totale, per piattaforma, tipo, status)
- [x] Azioni: modifica progetto (dialog pre-compilato), archivia progetto (AlertDialog conferma)
- [x] Navigazione: click su progetto → pagina dettaglio, back link "Tutti i progetti"
- [x] Breadcrumbs aggiornati: UUID detection → "Detail", label "audit-log"
- [x] Loading skeletons per lista e dettaglio
- **Done when**: Build OK (23 route), CRUD completo via UI, navigazione fluida, stati vuoti gestiti ✅

### Step 2.3 — Content Add (Singolo) ✅
- [x] `POST /api/projects/:id/content` — aggiunta singolo contenuto, discoveryMethod=MANUAL
- [x] Validazione Zod in `lib/validations/content.ts` (Zod v4: nativeEnum senza required_error)
- [x] Calcolo `contentHash` (SHA-256 di `url` || `rawContent`) per dedup
- [x] Calcolo `wordCount` da `rawContent` se presente
- [x] Generazione `excerpt` (primi 200 caratteri di rawContent) se non fornito
- [x] Check duplicati: se hash esiste nel progetto, ritorna errore 409
- [x] Blocco aggiunta su progetto archiviato → 400
- [x] Ownership check del progetto
- [x] Bottone "Aggiungi contenuto" in `/projects/:id` → `add-content-dialog.tsx`
- [x] Form: titolo, URL, piattaforma (select), tipo (select), data pubblicazione, contenuto (textarea)
- [x] `CONTENT_CREATED` aggiunto a `AUDIT_ACTIONS` e loggato
- **Note**: Zod v4 — `nativeEnum` non accetta `required_error`, rimosso
- **Done when**: Build OK (24 route), utente può aggiungere contenuti, dedup funziona ✅

### Step 2.4 — Content List & Filters ✅
- [x] `GET /api/projects/:id/content` con paginazione e filtri (status, sourcePlatform, contentType, search, sortBy, sortOrder)
- [x] ContentQuerySchema con `.catch(undefined)` su enum opzionali (Zod v4)
- [x] Paginazione offset-based (page + limit=20)
- [x] Sezione contenuti nella pagina `/projects/:id` con tabella server-rendered
- [x] Colonne: Titolo (link + icona URL esterno), Piattaforma (badge), Tipo, Status (badge colorato), Data
- [x] `content-filters.tsx`: search + select piattaforma/tipo/status (URL search params)
- [x] `content-pagination.tsx`: prev/next con indicatore pagina/totale
- [x] 6 query Prisma in parallelo (4 stats + lista filtrata + count filtrato)
- [x] Empty state distinto: "nessun contenuto nel progetto" vs "nessun risultato per questi filtri"
- **Done when**: Build OK (24 route), lista filtrabile e paginabile, stats sempre non filtrate ✅

### Step 2.5 — Content Detail & Edit ✅
- [x] `GET /api/projects/:id/content/:contentId` — dettaglio completo
- [x] `PATCH /api/projects/:id/content/:contentId` — modifica campi + cambio status; ricalcola wordCount/excerpt se rawContent aggiornato
- [x] `DELETE /api/projects/:id/content/:contentId` — hard delete con audit log
- [x] resolveItem via `findFirst({ id, projectId })` — impedisce IDOR
- [x] `UpdateContentSchema` e `EditContentFormSchema` in lib/validations/content.ts
- [x] `CONTENT_UPDATED`, `CONTENT_DELETED` in lib/audit.ts
- [x] Pagina `/projects/:id/content/:contentId`: header + grid 2/3+1/3
  - rawContent in `<pre>` con whitespace-pre-wrap, o empty state con suggerimento
  - Sidebar: word count, lingua, published, added, updated, sorgente, hash (12 char)
  - `ChangeStatusSelect`: dropdown status sia in header che sidebar
  - `EditContentDialog`: form pre-compilato (no status)
  - `DeleteContentButton`: hard delete AlertDialog + redirect al progetto
- [x] breadcrumbs.tsx: "content" → "Contenuti"
- **Done when**: Build OK (26 route), CRUD completo, edit + status change + delete funzionanti ✅

### Step 2.6 — CSV Import
- [ ] `POST /api/projects/:id/content/import` — upload e parsing CSV
- [ ] Formato CSV atteso: `url,title,sourcePlatform,contentType,publishedAt` (con header)
- [ ] Parsing con `papaparse` (npm) server-side
- [ ] Validazione per riga: ogni riga validata con Zod, righe invalide skippate
- [ ] Report import: `{ imported: N, skipped: N, errors: [{ row: N, error: "..." }] }`
- [ ] Dedup: skip righe con hash già presente nel progetto
- [ ] UI: bottone "Import CSV" nel progetto → dialog con file upload + area drag-and-drop
- [ ] Preview delle prime 5 righe prima di confermare
- [ ] Risultato import mostrato in dialog (successo/errori)
- [ ] Template CSV scaricabile (link o generato)
- **Done when**: Import CSV funzionante end-to-end, errori gestiti per riga, template disponibile

### Step 2.7 — Content Management Actions
- [ ] Azioni bulk: seleziona multipli → cambia status, elimina
- [ ] Checkbox nella DataTable per selezione multipla
- [ ] Toolbar azioni bulk: "Approve Selected", "Archive Selected", "Delete Selected"
- [ ] `PATCH /api/projects/:id/content/bulk` — operazione su array di IDs
- [ ] Conferma per azioni distruttive (delete)
- [ ] Toast feedback per tutte le azioni
- [ ] Contatori aggiornati in tempo reale nella project overview
- **Done when**: Selezione multipla, azioni bulk, feedback utente, contatori sincronizzati

### Step 2.8 — Phase 2a Polish
- [ ] Loading skeletons per pagine progetti e contenuti
- [ ] Empty states per: nessun progetto, nessun contenuto, nessun risultato filtri
- [ ] Error boundaries per sezione progetti e contenuti
- [ ] Audit log: log creazione/modifica/delete contenuti e progetti
- [ ] Sidebar aggiornata: "Projects" ora mostra il conteggio o un indicatore
- [ ] Review responsive su mobile di tutte le nuove pagine
- [ ] Test manuale completo di tutti i flow
- **Done when**: UX coerente con Fase 1, tutti gli stati edge gestiti, audit completo

---

## Piano Step Atomici — Fase 2b (Discovery Agent)

> Prerequisito: Python 3.11+, pip installato sulla macchina di sviluppo

### Step 2b.0 — Python FastAPI Scaffolding
- [ ] Struttura `services/engine/` con FastAPI app
- [ ] `Dockerfile` per il servizio Python
- [ ] Aggiornare `docker-compose.yml`: aggiungere servizio `engine`
- [ ] Health check endpoint: `GET /health`
- [ ] Configurazione CORS per comunicazione con Next.js
- [ ] Shared config: variabili d'ambiente (DATABASE_URL, REDIS_URL, etc.)
- [ ] `requirements.txt` con dipendenze base (fastapi, uvicorn, httpx, beautifulsoup4, etc.)
- [ ] ADR-008: Python service architecture
- **Done when**: `docker compose up` avvia anche il servizio Python, `/health` risponde

### Step 2b.1 — Web Crawler Agent
- [ ] Endpoint `POST /api/crawl/site` — riceve URL sito, restituisce lista pagine trovate
- [ ] Crawler con `httpx` + `BeautifulSoup`: segue link interni, max depth configurabile
- [ ] Estrazione contenuto principale (rimozione nav, footer, sidebar) con heuristics
- [ ] Estrazione metadata: title, description, og:tags, published_date
- [ ] Rate limiting: max N requests/secondo per dominio
- [ ] Timeout e error handling per pagine inaccessibili
- [ ] Risultati salvati come `ContentItem` con status `DISCOVERED` e method `AGENT_CRAWL`
- [ ] API Next.js: `POST /api/projects/:id/discovery/crawl` che chiama il servizio Python
- **Done when**: Dato un URL sito, il crawler trova e salva le pagine con contenuto estratto

### Step 2b.2 — Platform Search Agent
- [ ] Integrazione Google Custom Search JSON API (o alternativa scelta)
- [ ] Endpoint `POST /api/search/platform` — riceve nome/brand + piattaforme target
- [ ] Query templates per piattaforma:
  - Website: `site:domain.com`
  - Substack: `site:substack.com "nome autore"`
  - Medium: `site:medium.com "nome autore"`
  - LinkedIn: `site:linkedin.com/pulse "nome autore"` (articoli)
  - Reddit: `site:reddit.com "nome autore" OR "brand"`
  - YouTube: `site:youtube.com "nome canale"`
  - News: `"nome brand" -site:domain.com` (menzioni esterne)
- [ ] Parsing risultati: URL, titolo, snippet
- [ ] Salvataggio come `ContentItem` con status `DISCOVERED` e method `AGENT_SEARCH`
- [ ] Dedup contro contenuti già esistenti nel progetto
- [ ] API Next.js: `POST /api/projects/:id/discovery/search`
- **Done when**: Ricerca su piattaforme funzionante, risultati salvati e deduplicati

### Step 2b.3 — Content Fetching & Extraction
- [ ] Per ogni `ContentItem` con URL ma senza `rawContent`: fetch e estrazione
- [ ] Endpoint `POST /api/crawl/extract` — riceve URL, restituisce contenuto pulito
- [ ] Cheerio/BeautifulSoup per siti statici, Puppeteer/Playwright per SPA
- [ ] Heuristic per estrarre il contenuto principale (article body)
- [ ] Calcolo wordCount, excerpt, contentHash dopo estrazione
- [ ] Batch processing: processare N contenuti in parallelo
- [ ] Update ContentItem con rawContent estratto
- **Done when**: Contenuti scoperti hanno rawContent estratto e metadata calcolati

### Step 2b.4 — Discovery Job Orchestration
- [ ] BullMQ job queue per orchestrare discovery
- [ ] Job types: `CRAWL_SITE`, `SEARCH_PLATFORM`, `FULL_DISCOVERY`
- [ ] `FULL_DISCOVERY` = crawl sito + search su tutte le piattaforme
- [ ] Tracking stato job in tabella `DiscoveryJob`
- [ ] API Next.js:
  - `POST /api/projects/:id/discovery/start` — avvia job
  - `GET /api/projects/:id/discovery/status` — stato job corrente
  - `GET /api/projects/:id/discovery/history` — storico job
- [ ] Progress tracking: aggiornamento percentuale/conteggio durante l'esecuzione
- **Done when**: Job avviabili, tracciabili, con stato persistente

### Step 2b.5 — Discovery Review UI
- [ ] Nel progetto, tab/sezione "Discovery" con:
  - Bottone "Start Discovery" → dialog configurazione (cosa cercare)
  - Stato job corrente (progress bar, conteggio trovati)
  - Storico job passati
- [ ] Lista risultati `DISCOVERED` (pending review):
  - Card per ogni risultato: titolo, URL, piattaforma, snippet
  - Azioni: Approve, Reject, Preview
  - Bulk approve/reject
- [ ] Preview contenuto: modal con contenuto estratto
- [ ] Dopo approve/reject, il contenuto si sposta nella lista principale
- **Done when**: Flow completo discovery → review → approve/reject funzionante

### Step 2b.6 — Phase 2b Polish
- [ ] Error handling robusto per crawler (timeout, 404, captcha, rate limit)
- [ ] Retry logic per job falliti
- [ ] UI feedback per stati di errore del discovery
- [ ] Loading states durante il discovery
- [ ] Audit log per discovery jobs
- [ ] Test manuale di tutti i flow
- **Done when**: Discovery agent robusto, errori gestiti gracefully, UX coerente

---

## Note Implementative

### Ownership & Authorization Pattern
Ogni API route che accede a un progetto deve verificare:
1. L'utente è autenticato
2. Il progetto appartiene all'utente (`project.userId === currentUser.id`)
3. Per i content items: il content item appartiene al progetto dell'utente

Creare helper riusabile:
```typescript
// lib/auth.ts
async function assertProjectOwnership(projectId: string, userId: string): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== userId) throw new NotFoundError();
  return project;
}
```

### Content Hash Strategy
```typescript
import { createHash } from "crypto";

function generateContentHash(url?: string, rawContent?: string): string {
  const input = url || rawContent || "";
  return createHash("sha256").update(input).digest("hex");
}
```

### CSV Format Template
```csv
url,title,sourcePlatform,contentType,publishedAt
https://example.com/post-1,My First Post,WEBSITE,ARTICLE,2024-01-15
https://medium.com/@me/post,Medium Article,MEDIUM,BLOG_POST,2024-02-20
,Manual Note,OTHER,OTHER,
```
Regole: `url` opzionale, `title` e `sourcePlatform` obbligatori, `contentType` default `ARTICLE` se omesso.

---

## Piano di Sviluppo — Fasi Successive (Overview)

### Fase 3 — Knowledge Graph & Analysis
- Step 3.0: Schema graph (nodi, edges, entità) in PostgreSQL
- Step 3.1: Entity extraction pipeline (Python)
- Step 3.2: Topic clustering
- Step 3.3: Embedding generation e storage (pgvector)
- Step 3.4: AI Readiness scoring engine
- Step 3.5: Fan-Out analysis
- Step 3.6: Passage-level quality assessment

### Fase 4 — Dashboard & Visualization
- Step 4.0: Knowledge graph visualization (D3.js o react-force-graph)
- Step 4.1: AI Readiness dashboard
- Step 4.2: Gap analysis view
- Step 4.3: Competitor benchmark view
- Step 4.4: Content inventory enriched view

### Fase 5 — Content Generation Agent
- Step 5.0: Content improvement suggestions engine
- Step 5.1: Content generation pipeline
- Step 5.2: Platform recommendation engine
- Step 5.3: Conversational interface per l'agente

### Fase 6 — Polish & Launch
- Step 6.0: Onboarding flow
- Step 6.1: Landing page
- Step 6.2: Billing integration (Stripe)
- Step 6.3: E2E testing
- Step 6.4: Performance optimization
- Step 6.5: Documentation finale

---

## Variabili d'Ambiente Richieste

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_visibility_platform"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-secret-here"

# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Anthropic (Fase 2+)
ANTHROPIC_API_KEY=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Note per Claude Code

- **Leggi sempre questo file** prima di iniziare qualsiasi task
- **Aggiorna questo file** dopo ogni step completato (checkbox, stato, ultimo commit)
- **Un step alla volta**: completa e verifica prima di procedere
- **Chiedi conferma** prima di procedere al prossimo step se qualcosa non è chiaro
- **Segui le convenzioni** sopra descritte rigorosamente
- **Crea un ADR** per ogni decisione architetturale significativa non già documentata
