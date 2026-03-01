# Visiblee

Piattaforma SaaS per migliorare la visibilità dei brand nell'ecosistema AI-based: Google AI Mode, ChatGPT, Perplexity, Gemini.

Analizza i contenuti digitali esistenti, costruisce un knowledge graph della presenza del brand, e guida nella creazione di contenuti ottimizzati per massimizzare le probabilità di essere citati dagli LLM.

---

## Tech Stack

| Layer | Tecnologia |
|-------|-----------|
| Frontend | Next.js 16 (App Router) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Database | PostgreSQL 16 + pgvector |
| ORM | Prisma 7 |
| Auth | NextAuth.js v5 (Google OAuth + Credentials) |
| Job Queue | BullMQ + Redis |
| AI Engine | Python FastAPI (porta 8000) |
| LLM | Claude API (Anthropic) |
| Embeddings | fastembed ONNX — MiniLM-L12-v2 384 dim |
| Dev Environment | Docker Compose |

---

## Prerequisiti

- **Node.js** 20+
- **npm** (workspace monorepo)
- **Python** 3.11+ (solo per sviluppo engine locale; in produzione usa Docker)
- **Docker** e **Docker Compose**

---

## Setup Locale

### 1. Clona il repository

```bash
git clone https://github.com/andrearugge/visiblee.git
cd visiblee
```

### 2. Configura le variabili d'ambiente

Crea il file `.env` alla root del progetto e compilalo con i tuoi valori (vedi la sezione [Variabili d'Ambiente](#variabili-dambiente)):

```bash
cp .env.example .env
```

Poi crea il symlink che permette a Next.js di leggere lo stesso file:

```bash
ln -s ../../.env apps/web/.env.local
```

> Un solo file `.env` viene usato sia da Docker Compose che da Next.js.

### 3. Avvia i servizi Docker

```bash
docker compose up -d
```

Avvia in background: **PostgreSQL**, **Redis**, e l'**engine Python** (porta 8000).

> Il primo avvio dell'engine scarica il modello ONNX (~90 MB). Attendi che il container sia `healthy` prima di procedere.

Verifica lo stato:

```bash
docker compose ps
```

### 4. Installa le dipendenze

Dalla **root** del monorepo:

```bash
npm install
```

### 5. Configura il database

```bash
npm run db:migrate
npm run db:seed
```

> I comandi `db:*` vanno eseguiti dalla **root** del monorepo tramite npm workspaces.

### 6. Avvia i servizi in sviluppo

Apri **tre terminali** separati:

**Terminale 1 — Next.js dev server:**
```bash
npm run dev
```

**Terminale 2 — BullMQ worker (job asincroni):**
```bash
npm run worker
```

**Terminale 3 — Docker (già avviato al passo 3, lascialo girare)**

L'app è disponibile su [http://localhost:3000](http://localhost:3000).

---

## Scripts Disponibili

Tutti i comandi si eseguono dalla **root** del monorepo:

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Avvia Next.js in modalità sviluppo (porta 3000) |
| `npm run build` | Build di produzione Next.js |
| `npm run worker` | Avvia il BullMQ worker (job discovery + analysis) |
| `npm run db:migrate` | Applica le migration Prisma |
| `npm run db:seed` | Popola il DB con dati iniziali |
| `npm run db:generate` | Rigenera il client Prisma |
| `npm run db:studio` | Apre Prisma Studio (GUI database) |

---

## Variabili d'Ambiente

Configurate in un unico `.env` alla root, condiviso da Docker Compose e Next.js (tramite symlink `apps/web/.env.local → ../../.env`).

| Variabile | Descrizione | Default/Esempio |
|-----------|-------------|-----------------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://postgres:postgres@localhost:5432/visiblee` |
| `REDIS_URL` | Connection string Redis | `redis://localhost:6379` |
| `AUTH_SECRET` | Secret per la crittografia sessioni NextAuth | Genera con `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL base dell'app | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Dal Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Dal Google Cloud Console |
| `ANTHROPIC_API_KEY` | API key Claude (Anthropic) | Da [console.anthropic.com](https://console.anthropic.com) |
| `BRAVE_SEARCH_API_KEY` | API key Brave Search | Da [api.search.brave.com](https://api.search.brave.com) — 2.000 query/mese gratis |
| `ENGINE_API_KEY` | Shared secret Next.js ↔ engine | Stringa random, cambia in produzione |
| `ENGINE_URL` | URL dell'engine Python | `http://localhost:8000` |
| `NEXT_PUBLIC_APP_URL` | URL pubblico dell'app | `http://localhost:3000` |

### Google OAuth

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un progetto e vai su **APIs & Services → Credentials**
3. Crea un **OAuth 2.0 Client ID** (tipo: Web Application)
4. Aggiungi come redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copia **Client ID** e **Client Secret** nel file `.env.local`

---

## Struttura del Progetto

```
visiblee/
├── apps/web/              # Next.js app (frontend + API routes)
│   ├── src/app/           # App Router: pagine, layout, API
│   ├── src/lib/           # Utility: auth, prisma, queue, scoring
│   ├── src/workers/       # BullMQ worker (processo standalone)
│   └── prisma/            # Schema, migration, seed
├── services/engine/       # Python FastAPI (AI processing)
│   ├── agents/            # Crawler, search, extractor, embedder, clusterer
│   └── api/               # Endpoint REST
├── docker-compose.yml     # PostgreSQL + Redis + engine
├── .env.example           # Template variabili d'ambiente
├── CLAUDE.md              # Stato progetto e note architetturali
└── HOWTO.md               # Guida utente al flusso della piattaforma
```

---

## Engine Python

L'engine gira in Docker ed è accessibile su `http://localhost:8000`.

- Documentazione Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/health](http://localhost:8000/health)

Se modifichi il codice Python, ricostruisci l'immagine:

```bash
docker compose build engine && docker compose up -d engine
```

---

## License

Proprietary — All rights reserved.
