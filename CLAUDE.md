# CLAUDE.md — AI Visibility Platform

> Questo file è il punto di riferimento per Claude Code. Contiene lo stato corrente del progetto, le convenzioni, e il piano di sviluppo step-by-step.

## Stato Corrente del Progetto

**Fase**: 1 — Foundation
**Step corrente**: 1.9 completato — Fase 1 DONE ✅
**Ultimo commit**: feat(polish): step 1.9 — error boundaries, loading skeletons, toast, 404/error pages
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

## Piano di Sviluppo — Fasi Successive (Overview)

### Fase 2 — Content Discovery
- Step 2.0: Modelli Prisma per Projects, ContentItems, DiscoveryJobs
- Step 2.1: CRUD Projects
- Step 2.2: Content manual add (singolo + bulk CSV)
- Step 2.3: Python FastAPI service scaffolding + Docker
- Step 2.4: Discovery Agent — web crawler
- Step 2.5: Discovery Agent — platform search (Substack, Medium, LinkedIn)
- Step 2.6: Discovery Agent — mentions search
- Step 2.7: Discovery results review UI (approve/reject)
- Step 2.8: Content detail view con metadata

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
