# Visiblee — Guida al deployment in produzione

## Stack consigliato

| Servizio | Provider | Free tier |
|----------|----------|-----------|
| Next.js (web) | **Vercel** | Hobby — gratuito |
| PostgreSQL + pgvector | **Neon** | 0.5 GB, 191 compute-hours/mese |
| Redis | **Upstash** | 10.000 cmd/giorno, 256 MB |
| BullMQ Worker | **Railway** | $5/mese credito incluso |
| Python Engine (FastAPI) | **Railway** | stesso progetto del worker |

---

## Step 1 — Database: Neon

1. Crea account su https://neon.tech → **New project**
2. Copia la `DATABASE_URL` (formato: `postgresql://user:pass@host/dbname?sslmode=require`)
3. Apri la **SQL Editor** di Neon e abilita pgvector:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Esegui le migration sul DB Neon dalla root del monorepo:
   ```bash
   cd apps/web
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```
   > `migrate deploy` applica le migration esistenti senza creare nuove (adatto per produzione).

---

## Step 2 — Redis: Upstash

1. Crea account su https://upstash.com → **Create database** → seleziona **Redis**
2. Scegli la region più vicina ai tuoi server Railway/Vercel (es. `eu-west-1`)
3. Abilita **TLS** (è già abilitato di default su Upstash)
4. Copia la **Redis URL** (formato: `rediss://default:TOKEN@host:port`)
   > Il prefisso `rediss://` (con doppia `s`) attiva automaticamente TLS nel codice.

---

## Step 3 — Engine Python: Railway

1. Crea account su https://railway.app → **New project** → **Deploy from GitHub repo**
2. Seleziona il repository `visiblee`
3. Nella configurazione del servizio:
   - **Root Directory**: `services/engine`
   - **Build**: Railway rileva automaticamente il `Dockerfile`
4. Aggiungi le **variabili d'ambiente** nel pannello Settings → Variables:
   ```
   ENGINE_API_KEY=<segreto-lungo-e-random>
   ANTHROPIC_API_KEY=sk-ant-...
   BRAVE_SEARCH_API_KEY=BSA...
   ```
5. Dopo il deploy, copia il **public URL** del servizio (es. `https://engine-production-xxxx.up.railway.app`)
   → questa sarà `ENGINE_URL` per Vercel e per il worker.

> **Nota**: i modelli fastembed vengono scaricati al primo avvio (~300 MB). Il cold start iniziale può richiedere 2-3 minuti.

---

## Step 4 — Worker BullMQ: Railway

1. Nello stesso progetto Railway, clicca **New service** → **GitHub repo** (stesso repo)
2. Configurazione del servizio:
   - **Root Directory**: `.` (root del monorepo)
   - Railway usa `railway.toml` presente nella root per build e start command
3. Aggiungi le **variabili d'ambiente**:
   ```
   DATABASE_URL=postgresql://...         # Neon URL (con ?sslmode=require)
   REDIS_URL=rediss://default:TOKEN@...  # Upstash URL
   ENGINE_URL=https://engine-xxxx.up.railway.app
   ENGINE_API_KEY=<stesso segreto dell'engine>
   ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Il worker non espone nessuna porta HTTP — non serve un dominio pubblico.
5. Verifica i log: dovresti vedere:
   ```
   [worker] Discovery worker started — queue: discovery
   [worker] Analysis worker started — queue: analysis
   [worker] Maintenance worker started — audit log cleanup @ 03:00 daily, discovery schedule check @ every hour
   ```

---

## Step 5 — Next.js: Vercel

1. Vai su https://vercel.com → **Add new project** → importa il repo GitHub
2. Configurazione:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: Next.js (rilevato automaticamente)
   - **Build Command**: lascia vuoto (usa `vercel.json` che esegue `prisma migrate deploy && next build`)
   - **Install Command**: `npm install` (il `postinstall` esegue `prisma generate` automaticamente)
3. Aggiungi le **variabili d'ambiente** (Production):
   ```
   DATABASE_URL=postgresql://...         # Neon URL
   AUTH_SECRET=<32+ char random>         # openssl rand -base64 32
   NEXTAUTH_URL=https://tuo-dominio.vercel.app
   REDIS_URL=rediss://default:TOKEN@...  # Upstash URL
   ENGINE_URL=https://engine-xxxx.up.railway.app
   ENGINE_API_KEY=<stesso segreto>
   ANTHROPIC_API_KEY=sk-ant-...
   BRAVE_SEARCH_API_KEY=BSA...
   CHAT_MODEL=claude-haiku-4-5-20251001
   GOOGLE_CLIENT_ID=<google oauth>       # se usi Google OAuth
   GOOGLE_CLIENT_SECRET=<google oauth>
   ```
4. Clicca **Deploy**.

> **Nota su Google OAuth**: dopo il primo deploy, aggiorna le **Authorized redirect URIs** nella Google Console:
> `https://tuo-dominio.vercel.app/api/auth/callback/google`

---

## Step 6 — Verifica end-to-end

- [ ] **Login** funziona (Google OAuth o email/password)
- [ ] **Creazione progetto** → appare nella dashboard
- [ ] **Discovery** → avvia job → worker lo processa (controlla log Railway) → notifica ricevuta
- [ ] **Analysis** → avvia full analysis → score aggiornato
- [ ] **Chat** → risponde con contesto del progetto (richiede engine online)
- [ ] **Ricerca semantica** → trova contenuti per significato
- [ ] **Discovery ricorrente** → configura uno schedule → controlla che `lastRunAt` si aggiorni

---

## Generare `AUTH_SECRET`

```bash
openssl rand -base64 32
```

## Generare `ENGINE_API_KEY`

```bash
openssl rand -hex 32
```

---

## Troubleshooting

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| Build Vercel fallisce su `prisma generate` | `postinstall` non eseguito | Verifica che `package.json` abbia `"postinstall": "prisma generate"` |
| Worker non si connette a Redis | URL sbagliata o TLS mancante | Usa `rediss://` (doppia s) per Upstash |
| Engine timeout su primo avvio | Download modelli fastembed | Attendi 2-3 min, Railway ha health-check con retry |
| Google OAuth redirect error | URI non aggiornata | Aggiungi `https://dominio/api/auth/callback/google` in Google Console |
| `vector` type error su Neon | Estensione non abilitata | `CREATE EXTENSION IF NOT EXISTS vector;` sulla SQL Editor Neon |
| Chat non risponde | Engine non raggiungibile | Controlla `ENGINE_URL` e `ENGINE_API_KEY` nelle variabili Vercel |
