# AI Visibility Platform

Una web app SaaS che aiuta brand, creator e professionisti a migliorare la propria visibilità nel nuovo ecosistema di ricerca AI-based (Google AI Mode, ChatGPT, Perplexity, Gemini).

La piattaforma analizza i contenuti digitali esistenti, costruisce un knowledge graph della presenza digitale, e guida l'utente nella creazione e ottimizzazione dei contenuti per massimizzare le probabilità di essere citato dagli LLM.

## Il Problema

I motori di ricerca stanno passando dai "10 link blu" a risposte sintetiche generate dall'AI. Per essere visibili in questo nuovo ecosistema non basta più posizionarsi in prima pagina: bisogna **essere citati e referenziati dalle AI**.

L'analisi dei patent di Google e della ricerca di settore rivela 4 meccanismi chiave:

1. **Query Fan-Out** — il sistema genera decine di query sintetiche dalla query originale
2. **Pairwise Ranking** — i passaggi dei documenti vengono confrontati a coppie da un LLM
3. **User Embeddings** — ogni utente ha un profilo vettoriale che personalizza le risposte
4. **Generative Synthesis** — il sistema assembla risposte composite da un corpus personalizzato

## Funzionalità Principali

- **Content Discovery** — Inventario automatico dei contenuti digitali su tutte le piattaforme
- **Knowledge Graph** — Mappa semantica della presenza digitale
- **AI Readiness Scoring** — Valutazione dei contenuti rispetto ai meccanismi AI
- **Gap Analysis** — Identificazione di opportunità e contenuti mancanti
- **Content Generation** — Agente AI per creare contenuti ottimizzati per la citazione AI

## Tech Stack

| Layer | Tecnologia |
|-------|-----------|
| Frontend | Next.js 14+ (App Router) |
| UI | shadcn/ui + Tailwind CSS |
| Database | PostgreSQL 16 + pgvector |
| ORM | Prisma |
| Auth | NextAuth.js v5 (Google OAuth + Credentials) |
| Job Queue | BullMQ + Redis |
| AI Service | Python FastAPI |
| LLM | Claude API (Anthropic) |
| Dev Environment | Docker Compose |

## Setup Locale

### Prerequisiti

- Node.js 20+
- pnpm (o npm)
- Docker & Docker Compose
- Account Google Cloud (per OAuth)

### 1. Clona il repository

```bash
git clone https://github.com/your-org/ai-visibility-platform.git
cd ai-visibility-platform
```

### 2. Configura le variabili d'ambiente

```bash
cp .env.example .env
```

Compila `.env` con i tuoi valori. Vedi la sezione [Variabili d'Ambiente](#variabili-dambiente) per i dettagli.

### 3. Avvia i servizi Docker

```bash
docker compose up -d
```

Questo avvia PostgreSQL e Redis in locale.

### 4. Installa le dipendenze e configura il database

```bash
cd apps/web
npm install
npx prisma migrate dev
npx prisma db seed
```

### 5. Avvia il server di sviluppo

```bash
npm run dev
```

L'app è disponibile su `http://localhost:3000`.

## Variabili d'Ambiente

| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://postgres:postgres@localhost:5432/ai_visibility_platform` |
| `REDIS_URL` | Connection string Redis | `redis://localhost:6379` |
| `NEXTAUTH_URL` | URL base dell'app | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Secret per session encryption | Genera con `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Dal Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Dal Google Cloud Console |

### Configurazione Google OAuth

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto (o seleziona esistente)
3. Vai su "APIs & Services" → "Credentials"
4. Crea "OAuth 2.0 Client ID" (tipo: Web Application)
5. Aggiungi `http://localhost:3000/api/auth/callback/google` come redirect URI autorizzato
6. Copia Client ID e Secret nel file `.env`

## Struttura del Progetto

```
ai-visibility-platform/
├── apps/web/          # Next.js app (frontend + API)
├── services/engine/   # Python FastAPI (AI processing)
├── docs/adr/          # Architecture Decision Records
├── CLAUDE.md          # Stato progetto per Claude Code
└── docker-compose.yml # Dev environment
```

Vedi [CLAUDE.md](./CLAUDE.md) per la struttura dettagliata e il piano di sviluppo.

## Architettura

L'app segue un'architettura a due servizi:

- **Next.js** gestisce frontend, autenticazione, API CRUD, e orchestrazione
- **Python FastAPI** gestisce il lavoro AI-intensive: crawling, NLP, embedding, generazione

I servizi comunicano via REST. I task pesanti sono gestiti tramite BullMQ (job queue con Redis).

Per le decisioni architetturali dettagliate, vedi i [documenti ADR](./docs/adr/).

## Sviluppo

Lo sviluppo segue un approccio rigorosamente incrementale:

- **Step atomici**: ogni task è circoscritto e verificabile indipendentemente
- **Commit atomici**: un commit = una unità logica di lavoro
- **Test prima di procedere**: ogni step verificato funzionante prima del successivo
- **CLAUDE.md aggiornato**: stato del progetto sempre sincronizzato

Vedi il piano di sviluppo completo in [CLAUDE.md](./CLAUDE.md).

## Documentazione

- [CLAUDE.md](./CLAUDE.md) — Stato del progetto, convenzioni, piano di sviluppo
- [docs/adr/](./docs/adr/) — Architecture Decision Records
- [CHANGELOG.md](./CHANGELOG.md) — Log delle modifiche

## License

Proprietary — All rights reserved.
