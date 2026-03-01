# Refactor Plan — Navigazione e Flow

Basato su `refactor.md`. Branch: `refactor`.

---

## Panoramica Cambiamenti

### Routing attuale → nuovo

| Attuale | Nuovo | Note |
|---------|-------|------|
| `/dashboard` | `/dashboard` | Diventa account recap (semplificato) |
| redirect post-login → `/dashboard` | redirect post-login → `/projects` | |
| `/projects` | `/projects` | Invariato |
| `/projects/[id]?tab=content` | `/projects/[id]/content` | Path-based |
| `/projects/[id]?tab=discovery` | `/projects/[id]/content/discovery` | Sotto /content |
| `/projects/[id]?tab=analysis` | `/projects/[id]/analysis` | Path-based |
| `/projects/[id]?tab=briefs` | `/projects/[id]/briefs` | Path-based |
| `/projects/[id]?tab=chat` | TBD — vedi nota | |
| `/graph` (globale) | `/projects/[id]/graph` | Spostato a livello progetto |
| `/content` (globale) | rimosso da nav | Pagina mantenuta, non in nav |
| — | `/projects/[id]` | Nuovo: project dashboard |
| — | `/projects/[id]/actions` | Nuovo: azioni correttive |
| — | `/projects/[id]/settings` | Nuovo: impostazioni progetto |

> **Chat**: il tab Chat è stato **rimosso** dalla pagina progetto (non ha senso in quel
> contesto senza storico). Verrà reintrodotto come sezione globale `/chat` — vedi § Chat.

### Sidebar globale (quando NON si è dentro un progetto)

```
◆ Visiblee
────────────────
Dashboard      (/dashboard)
Progetti       (/projects)
Impostazioni   (/settings)
────────────────
[Admin only]
Users          (/admin/users)
Audit Log      (/admin/audit-log)
```

Rimossi: Content, Graph.

### Sidebar progetto (quando si è dentro `/projects/[id]`)

```
◆ Visiblee
← Tutti i progetti
────────────────
[Nome Progetto]
────────────────
Dashboard      (/projects/[id])
Contenuti      (/projects/[id]/content)
Analisi        (/projects/[id]/analysis)
Graph          (/projects/[id]/graph)
Brief          (/projects/[id]/briefs)
Azioni         (/projects/[id]/actions)
Impostazioni   (/projects/[id]/settings)
```

---

## Approccio Tecnico: Sidebar Context

La Sidebar è un Client Component (`usePathname`, `useSession`). Il progetto layout
(`/projects/[id]/layout.tsx`) è un Server Component che fetcha il progetto.

**Pattern adottato:**
1. `ProjectNavContext` — React Context (client) con `{ projectId, projectName } | null`
2. `ProjectNavProvider` — Client Component che wrappa il contenuto del project layout
3. `Sidebar` legge il context: se presente → mostra project nav; se null → mostra global nav
4. Il project layout fetcha il progetto server-side e passa i dati al `ProjectNavProvider`

Questo evita parallel routes / slot e non richiede refactoring del layout padre.

---

## TODO List

### 0. Preparazione

- [x] Creare branch `refactor`
- [ ] Leggere questo file e allinearsi prima di ogni sessione di lavoro

---

### 1. Sidebar Context + Refactor Sidebar

**File coinvolti:**
- `src/components/dashboard/project-nav-context.tsx` ← nuovo
- `src/components/dashboard/nav-items.ts` ← modifica
- `src/components/dashboard/sidebar.tsx` ← modifica
- `src/components/dashboard/mobile-nav.tsx` ← modifica

**Tasks:**

- [ ] **1.1** Creare `project-nav-context.tsx`
  - `ProjectNavContext` con `{ projectId: string; projectName: string } | null`
  - `ProjectNavProvider` client component (wrappa con il context)
  - Hook `useProjectNav()` per consumare il context

- [ ] **1.2** Aggiornare `nav-items.ts`
  - Rimuovere `Content` (`/content`) e `Graph` (`/graph`) da `NAV_ITEMS`
  - Aggiungere costante `PROJECT_NAV_ITEMS` con le voci del progetto
    (Dashboard, Contenuti, Analisi, Graph, Brief, Azioni, Impostazioni)
    usando path relativi che ricevono `projectId` come parametro

- [ ] **1.3** Aggiornare `sidebar.tsx`
  - Consumare `useProjectNav()`
  - Se context presente: renderizza project nav (con back link "← Tutti i progetti",
    nome progetto come header, voci progetto)
  - Se context null: renderizza global nav (Dashboard, Progetti, Impostazioni + Admin section)
  - Mantenere admin section visibile nel project context? → Sì, in fondo

- [ ] **1.4** Aggiornare `mobile-nav.tsx`
  - Stesso adattamento della sidebar per supportare project context

---

### 2. Project Layout (`/projects/[id]/layout.tsx`)

**File coinvolti:**
- `src/app/(dashboard)/projects/[id]/layout.tsx` ← nuovo

**Tasks:**

- [ ] **2.1** Creare `layout.tsx` sotto `[id]/`
  - Server Component
  - Fetcha il progetto via Prisma (id, name, status)
  - Se progetto non trovato → `notFound()`
  - Wrappa `children` con `<ProjectNavProvider projectId={id} projectName={name}>`
  - Non aggiunge HTML aggiuntivo (il layout padre già fornisce la shell)

---

### 3. Routing Path-Based — Struttura Directory

Creare la nuova struttura sotto `src/app/(dashboard)/projects/[id]/`:

```
[id]/
├── layout.tsx                    ← (2.1) nuovo
├── page.tsx                      ← (4.x) project dashboard
├── content/
│   ├── page.tsx                  ← (5.x) lista contenuti + trigger discovery
│   ├── discovery/
│   │   └── page.tsx              ← (6.x) discovery (sotto-sezione)
│   └── [contentId]/
│       └── page.tsx              ← invariato (spostare se necessario)
├── analysis/
│   └── page.tsx                  ← (7.x) analisi AI
├── graph/
│   └── page.tsx                  ← (8.x) entity graph progetto
├── briefs/
│   └── page.tsx                  ← (9.x) briefs
├── actions/
│   └── page.tsx                  ← (10.x) azioni correttive
└── settings/
    └── page.tsx                  ← (11.x) impostazioni progetto
```

> I componenti `.tsx` flat nella cartella `[id]/` rimangono dove sono — sono
> componenti, non route. Solo i `page.tsx` definiscono le route.

---

### 4. Project Dashboard (`/projects/[id]`)

**File:** `src/app/(dashboard)/projects/[id]/page.tsx` ← **riscrivere**

Attualmente: pagina monolitica con tab `?tab=content|discovery|analysis|briefs|chat`.
Diventerà: dashboard di progetto con overview e flow guide.

- [ ] **4.1** Sezione header progetto
  - Nome progetto, dominio, stato (archived badge)
  - Bottone "Edit" → apre `EditProjectDialog`
  - Bottone "Archive" → `ArchiveProjectButton`

- [ ] **4.2** Cards statistiche (esistenti)
  - Totale contenuti, Approvati, Da revisionare, Piattaforme

- [ ] **4.3** Flow guide — sezione "Come funziona"
  - 6 card azioni nell'ordine del workflow:
    1. **Aggiungi contenuti** → link `/projects/[id]/content` (sempre attivo)
    2. **Scarica testo raw** → `FetchContentButton` (disabled se 0 contenuti totali)
    3. **Avvia analisi AI** → link ad avvio analisi (disabled se 0 contenuti approvati)
    4. **Rivedi analisi** → link `/projects/[id]/analysis` (disabled se no score)
    5. **Genera brief** → link `/projects/[id]/briefs` (disabled se no gap analysis)
    6. **Crea nuovi contenuti** → link `/projects/[id]/content` (sempre attivo)
  - Ogni card: icona, titolo, descrizione breve, stato (active/disabled/completed)

- [ ] **4.4** Sezione attività recente
  - Ultimi job di discovery/analisi con stato

---

### 5. Content Page (`/projects/[id]/content`)

**File:** `src/app/(dashboard)/projects/[id]/content/page.tsx` ← **nuovo**

Contenuto: corrisponde all'attuale `?tab=content`. Estrarre la logica dal `page.tsx` monolitico.

- [ ] **5.1** Fetch dati (identico all'attuale tab content)
  - Lista contenuti paginata con filtri
  - Breakdown per piattaforma/tipo/status

- [ ] **5.2** UI
  - Header con titolo "Contenuti" + bottone "Discovery" → link `/projects/[id]/content/discovery`
  - `FetchContentButton` per scaricare rawContent (tutti i contenuti del progetto)
  - `ContentFilters` (search, platform, type, status)
  - `ContentTable` con paginazione
  - Breakdown cards (by platform, by type, by status)
  - Bottoni add content: `AddContentDialog`, `CsvImportDialog`

---

### 6. Discovery Page (`/projects/[id]/content/discovery`)

**File:** `src/app/(dashboard)/projects/[id]/content/discovery/page.tsx` ← **nuovo**

Contenuto: corrisponde all'attuale `?tab=discovery`.

- [ ] **6.1** Breadcrumb implicito: Contenuti → Discovery

- [ ] **6.2** UI
  - `StartDiscoveryDialog`
  - `DiscoveryJobStatus` (polling)
  - `DiscoveryReview` (lista item DISCOVERED da approvare/rifiutare)
  - Storico job discovery

---

### 7. Analysis Page (`/projects/[id]/analysis`)

**File:** `src/app/(dashboard)/projects/[id]/analysis/page.tsx` ← **nuovo**

Contenuto: corrisponde all'attuale `?tab=analysis`.

- [ ] **7.1** UI
  - `AnalysisJobStatus` (se job in corso)
  - Bottone "Avvia analisi" (StartAnalysisButton — estrapolare dalla logica esistente)
  - `ScoreCard` (5 dimensioni)
  - `ContentHealthCard`
  - `GapAnalysisCard`
  - `SemanticSearchPanel`
  - `EntitiesPanel`
  - `TopicsPanel`
  - Chat AI — pannello collassabile o pulsante flottante (TBD)

- [ ] **7.2** (opzionale) Grafico score nel tempo
  - Schema DB non ha storico score — da valutare se aggiungere o rimandare

---

### 8. Graph Page (`/projects/[id]/graph`)

**File:** `src/app/(dashboard)/projects/[id]/graph/page.tsx` ← **nuovo**

Contenuto: corrisponde all'attuale `/graph` ma senza il project selector.

- [ ] **8.1** Fetch dati
  - Entità top 80 del progetto corrente (id già nel path)
  - Archi co-occorrenza

- [ ] **8.2** UI
  - `GraphCanvas` (riusare componente esistente da `/graph`)
  - Header con count entità + archi
  - Nessun project selector (già in contesto progetto)

---

### 9. Briefs Page (`/projects/[id]/briefs`)

**File:** `src/app/(dashboard)/projects/[id]/briefs/page.tsx` ← **nuovo**

Contenuto: corrisponde all'attuale `?tab=briefs`.

- [ ] **9.1** UI
  - `AnalysisJobStatus` (se job GENERATE_BRIEFS in corso)
  - Filtri status
  - `BriefsPanel`
  - `GenerateBriefsButton`

---

### 10. Actions Page (`/projects/[id]/actions`)

**File:** `src/app/(dashboard)/projects/[id]/actions/page.tsx` ← **nuovo**

Contenuto: nuovo, ma usa i dati di `ContentSuggestion` e `ProjectScore.suggestions`.

- [ ] **10.1** UI
  - Sezione "Suggerimenti strategici" (da `ProjectScore.suggestions`)
  - Sezione "Suggerimenti per contenuto" (da `ContentSuggestion`)
  - `GenerateSuggestionsButton` (batch generazione suggestions)
  - Lista contenuti con suggestions espandibili

---

### 11. Project Settings Page (`/projects/[id]/settings`)

**File:** `src/app/(dashboard)/projects/[id]/settings/page.tsx` ← **nuovo**

- [ ] **11.1** Form impostazioni progetto
  - Nome, dominio, descrizione (inline edit, non dialog)
  - Submit → PATCH `/api/projects/[id]`

- [ ] **11.2** Zona pericolo
  - `ArchiveProjectButton` (o restore se già archiviato)
  - Eventuale delete (se implementato)

---

### 12. Global Dashboard (`/dashboard`) — Semplificazione

**File:** `src/app/(dashboard)/dashboard/page.tsx` ← **modifica**

Diventa account recap invece di KPI progetto.

- [ ] **12.1** Rimuovere la tabella progetti dettagliata
- [ ] **12.2** Mostrare:
  - N. progetti attivi
  - N. totale contenuti analizzati (sum approvati di tutti i progetti)
  - N. analisi eseguite (count AnalysisJob completati)
  - N. brief generati
  - Link rapidi a `/projects`

---

### 13. Post-login Redirect

- [ ] **13.1** `src/proxy.ts` — cambiare redirect da `/dashboard` a `/projects`
  - Riga 27: `new URL("/dashboard", req.url)` → `new URL("/projects", req.url)`
  - Riga 41: idem per redirect admin non autorizzato

- [ ] **13.2** `src/app/(auth)/login/page.tsx`
  - `safeCallbackUrl` default: `/projects` invece di `/dashboard`
  - (Aggiornare anche il `login-form.tsx` defaultValue del prop)

---

### 14. Breadcrumbs Update

**File:** `src/components/dashboard/breadcrumbs.tsx` ← **modifica**

- [ ] **14.1** Aggiungere mapping per nuovi segmenti:
  - `analysis` → "Analisi"
  - `graph` → "Graph"
  - `briefs` → "Brief"
  - `actions` → "Azioni"
  - `settings` → "Impostazioni"
  - `discovery` → "Discovery"

- [ ] **14.2** UUID di progetto → mostrare nome progetto (recuperabile da context o API)

---

### 15. Aggiornamento Link Interni

Cercare e aggiornare tutti i riferimenti a tab-based navigation nei componenti:

- [ ] **15.1** `?tab=content` → `/projects/${id}/content`
- [ ] **15.2** `?tab=discovery` → `/projects/${id}/content/discovery`
- [ ] **15.3** `?tab=analysis` → `/projects/${id}/analysis`
- [ ] **15.4** `?tab=briefs` → `/projects/${id}/briefs`
- [ ] **15.5** Aggiornare back-link "← Torna ai progetti" (già esistente in page.tsx)

File da controllare: tutti i componenti in `[id]/`, il `dashboard/page.tsx`,
la tabella progetti.

---

### 16. Proxy + Protected Paths

**File:** `src/proxy.ts` ← **modifica**

- [ ] **16.1** Rimuovere `/content` e `/graph` da `PROTECTED_PREFIXES`
  (se le pagine globali vengono rimosse; se mantenute come redirect, lasciarle)
- [ ] **16.2** Verificare che `/projects/[id]/...` sia già coperto da `/projects` in PROTECTED_PREFIXES
  (già coperto da `pathname.startsWith("/projects")`)

---

### 17. Cleanup Finale

- [ ] **17.1** Global `/content/page.tsx` — valutare: redirect a `/projects` o mantenere
  (inventory cross-progetto potrebbe restare come pagina nascosta per future features)
- [ ] **17.2** Global `/graph/page.tsx` — aggiungere redirect a `/projects`
- [ ] **17.3** Rimuovere il vecchio `page.tsx` monolitico con tab `?tab=` una volta che
  tutte le route sono implementate e testate
- [ ] **17.4** Verificare `loading.tsx` per ogni nuova route (copyare quello esistente)
- [ ] **17.5** Verificare `error.tsx` per ogni nuova route

---

---

## Chat — Feature Futura (`/chat`)

> **Priorità: bassa** — non fa parte del refactor corrente.
> Il tab Chat è stato rimosso dalla pagina progetto su questo branch.

### Visione

La chat diventa una sezione globale cross-progetto, con storico conversazioni
per utente (pattern ChatGPT/Claude):

```
/chat              → listing conversazioni (tutte, ordinate per data)
/chat/new          → nuova conversazione (step 1: seleziona progetto)
/chat/[chatId]     → conversazione specifica con storico messaggi
```

### Flow utente

1. Utente va su `/chat`
2. Vede lista chat precedenti per utente (con progetto associato, data, anteprima ultimo messaggio)
3. Clicca "+ Nuova chat" → seleziona progetto dall'elenco → avvia la chat
4. L'assistente ha context RAG sul progetto selezionato (score + entità + gap + contenuti)
5. Lo storico è persistito nel DB

### Schema DB (da aggiungere in futuro)

```sql
ChatSession {
  id          String   @id @default(cuid())
  userId      String
  projectId   String
  title       String?  -- auto-generato dal primo messaggio
  createdAt   DateTime
  updatedAt   DateTime
  messages    ChatMessage[]
}

ChatMessage {
  id          String   @id @default(cuid())
  sessionId   String
  role        String   -- "user" | "assistant"
  content     String
  createdAt   DateTime
}
```

### Sidebar globale — aggiunta

La voce "Chat" viene aggiunta al nav globale (con badge N. conversazioni):
```
Dashboard
Progetti
Chat          (/chat)   ← nuova
Impostazioni
```

### TODO futura

- [ ] Migrare schema DB: aggiungere `ChatSession` e `ChatMessage`
- [ ] Creare API `/api/chat/sessions` (GET lista, POST nuova)
- [ ] Creare API `/api/chat/sessions/[id]/messages` (GET storico, POST messaggio SSE)
- [ ] Creare pagina `/chat/page.tsx` con lista sessioni
- [ ] Creare pagina `/chat/[chatId]/page.tsx` con chat UI (riusare `ChatPanel`)
- [ ] Adattare `ChatPanel` per funzionare con `sessionId` invece di `projectId` diretto
- [ ] Aggiungere "Chat" a `NAV_ITEMS` nella sidebar globale
- [ ] Aggiungere `/chat` a `PROTECTED_PREFIXES` in `proxy.ts`

---

## Ordine Consigliato di Implementazione

```
1 → 2 → 13 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 14 → 15 → 16 → 17
 sidebar  post-  project  content   analisi  graph  briefs  actions  settings  dashboard  link  proxy  cleanup
 context  login  layout   pages     page     page   page    page     page      update     upd   upd
```

Ogni step è testabile indipendentemente prima di procedere al successivo.

---

## Componenti da Riusare (non spostare, solo importare da nuovi page.tsx)

Tutti i componenti `.tsx` nella cartella `[id]/` rimangono dove sono:
- `score-card.tsx`, `content-health-card.tsx`, `gap-analysis-card.tsx`
- `entities-panel.tsx`, `topics-panel.tsx`, `semantic-search-panel.tsx`
- `briefs-panel.tsx`, `chat-panel.tsx`
- `discovery-job-status.tsx`, `discovery-review.tsx`
- `analysis-job-status.tsx`
- `content-table.tsx`, `content-filters.tsx`, `content-pagination.tsx`
- `start-discovery-dialog.tsx`, `add-content-dialog.tsx`, `csv-import-dialog.tsx`
- `edit-project-dialog.tsx`, `archive-project-button.tsx`
- `fetch-content-button.tsx`, `generate-briefs-button.tsx`, `generate-suggestions-button.tsx`

Eventuali componenti del `/graph` globale (`graph-canvas.tsx`) vanno copiati/spostati
nella nuova route di progetto.
