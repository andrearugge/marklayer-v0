# Visiblee — Guida al Flusso Utente

Questa guida spiega come usare Visiblee nel modo corretto, seguendo l'ordine logico delle funzionalità. Ogni fase si basa su quella precedente: saltare i passaggi produce risultati parziali o vuoti.

---

## Panoramica del Flusso

```
1. Registrazione & Login
        ↓
2. Crea un Progetto
        ↓
3. Aggiungi Contenuti  ←──────────────────────────────────┐
   (manuale, CSV, o Discovery automatico)                  │
        ↓                                                  │
4. Approva i Contenuti Scoperti                           │
        ↓                                                  │
5. Estrai il Testo (rawContent)                           │
        ↓                                                  │
6. Avvia l'Analisi AI                                     │
   (entità + embeddings + topic + score)                   │
        ↓                                                  │
7. Interpreta Score e Gap Analysis                        │
        ↓                                                  │
8. Genera Brief e Suggerimenti                            │
        ↓                                                  │
9. Usa la Chat AI per strategia                           │
        ↓                                                  │
10. Crea nuovi contenuti → torna al passo 3 ─────────────┘
```

---

## Passo 1 — Registrazione e Login

Vai su `/register` per creare un account con email e password, oppure usa il login con Google.

Dopo il login vieni portato alla **Dashboard** (`/dashboard`) che mostra una panoramica aggregata di tutti i tuoi progetti.

---

## Passo 2 — Crea un Progetto

Un **Progetto** rappresenta un brand o una presenza digitale da analizzare (es. un'azienda, un creator, un prodotto).

1. Vai su **Progetti** nella sidebar → clicca **Nuovo Progetto**
2. Inserisci: nome del brand, dominio web (es. `esempio.com`), descrizione opzionale
3. Clicca **Crea**

> Crea un progetto per ciascun brand o entità che vuoi analizzare separatamente.

---

## Passo 3 — Aggiungi Contenuti

I contenuti sono gli asset digitali del brand: articoli, post LinkedIn, newsletter, pagine web, ecc.

Hai tre modalità:

### 3a. Aggiunta Manuale

Nel tab **Contenuti** del progetto → clicca **Aggiungi contenuto**.
Inserisci titolo, URL, piattaforma, tipo e status.

Utile per aggiungere contenuti specifici che conosci già.

### 3b. Import CSV

Clicca **Importa CSV** per caricare un file con più contenuti in una sola operazione.

Formato colonne: `title, url, platform, type` (le altre sono opzionali).

### 3c. Discovery Automatico (raccomandato)

Vai al tab **Discovery** → clicca **Avvia Discovery**.

Scegli il tipo di job:

| Tipo | Cosa fa |
|------|---------|
| **Full Discovery** | Esegue sia crawl che ricerca piattaforme (consigliato) |
| **Crawl sito** | BFS sul dominio del progetto, trova pagine interne |
| **Ricerca piattaforme** | Cerca il brand su LinkedIn, Medium, Substack, News, Twitter, ecc. via Brave Search |

Il job gira in background. Lo stato si aggiorna automaticamente ogni 3 secondi.

> Il **Full Discovery** è il punto di partenza ideale per un nuovo progetto.

---

## Passo 4 — Approva i Contenuti Scoperti

I contenuti trovati dal Discovery entrano con status **Da revisionare** (DISCOVERED).

Nel tab **Discovery**, sezione **Da revisionare**:
- Clicca **Approva** sui contenuti rilevanti per il brand
- Clicca **Scarta** su quelli non pertinenti
- Usa **Approva tutti** per approvare in bulk

> Solo i contenuti **Approvati** vengono usati dall'analisi AI. Approvare contenuti non pertinenti degrada la qualità dello score.

---

## Passo 5 — Estrai il Testo (rawContent)

L'analisi AI richiede il testo completo dei contenuti. Il Discovery trova gli URL ma non scarica automaticamente il corpo degli articoli.

Nel tab **Discovery** (o **Contenuti**) trovi il pulsante **Scarica contenuto** che mostra quanti contenuti hanno URL ma non ancora il testo.

Clicca il pulsante: l'engine fa il fetch delle pagine in batch e salva il testo grezzo.

> Senza rawContent, i contenuti non possono essere analizzati (niente embeddings, niente entità).

---

## Passo 6 — Avvia l'Analisi AI

Vai al tab **Analisi** → clicca **Avvia Analisi** nella ScoreCard.

Il job **Full Analysis** esegue in sequenza:

1. **Estrazione Entità** — Claude Haiku identifica brand, persone, organizzazioni, prodotti, topic in ogni contenuto approvato
2. **Generazione Embeddings** — il modello fastembed converte ogni contenuto in un vettore semantico 384-dim
3. **Topic Clustering** — KMeans raggruppa i contenuti in cluster tematici e assegna un label AI
4. **Calcolo Score** — 5 dimensioni di AI Readiness Score (0-100 ciascuna) + suggerimenti testuali

Il job può richiedere qualche minuto a seconda del numero di contenuti. Lo stato si aggiorna ogni 4 secondi.

> Riesegui l'analisi ogni volta che aggiungi nuovi contenuti approvati (il badge **Score non aggiornato** te lo ricorda).

---

## Passo 7 — Interpreta Score e Gap Analysis

### AI Readiness Score

Lo score globale (0-100) sintetizza 5 dimensioni:

| Dimensione | Cosa misura |
|-----------|-------------|
| **Copertura** | Quante piattaforme sono presidiate |
| **Profondità** | Lunghezza media dei contenuti (target: 800+ parole) |
| **Freschezza** | % di contenuti pubblicati negli ultimi 6-12 mesi |
| **Autorevolezza** | Peso delle piattaforme (News > LinkedIn > Medium > Website > Twitter) |
| **Coerenza** | Quanto le entità chiave del brand sono menzionate trasversalmente |

Sotto lo score trovi i **suggerimenti testuali** generati da Claude Haiku per le dimensioni più basse.

### Gap Analysis

La sezione **Gap Analysis** mostra:
- **Piattaforme mancanti** — piattaforme chiave senza nessun contenuto
- **Piattaforme deboli** — piattaforme con ≤ 2 contenuti
- **Topic poco coperti** — cluster con meno di 3 contenuti
- **Entità poco menzionate** — entità chiave che compaiono in < 25% dei contenuti approvati
- **Freschezza** — contenuti datati (> 6 mesi o > 12 mesi)

Ogni gap ha una severity: **Critico** (rosso) o **Avviso** (giallo).

### Ricerca Semantica

La sezione **Ricerca Semantica** nel tab Analisi permette di cercare concettualmente nel portfolio.

Digita un topic o una domanda (es. "intelligenza artificiale nel retail") per vedere quali contenuti lo coprono e con quale rilevanza (% similarity). Se compaiono meno di 3 risultati, il topic è sotto-coperto.

---

## Passo 8 — Genera Brief e Suggerimenti

### Suggerimenti per Contenuto

Vai al **dettaglio di un singolo contenuto** (clicca il titolo nel tab Contenuti).

Nella sidebar trovi la sezione **Suggerimenti AI**: clicca **Genera Suggerimenti** per ottenere 3-5 azioni concrete su come migliorare quel contenuto specifico (es. "Aggiungi una sezione su X", "Espandi l'introduzione con dati recenti").

Puoi rigenerare i suggerimenti in qualsiasi momento con il bottone **Rigenera**.

Per generare suggerimenti per tutti i contenuti in batch, vai al tab **Analisi** e clicca **Genera Suggerimenti per tutti i contenuti**.

### Content Brief

I **Brief** sono guide di scrittura generate automaticamente dai gap del portfolio.

Vai al tab **Brief** → clicca **Genera Brief**.

Per ogni gap critico e warning, viene generato un brief strutturato con:
- Titolo proposto
- Piattaforma target
- 5 punti chiave da coprire
- Entità da menzionare
- Word count target
- Note aggiuntive

Gestisci i brief con le azioni:
- **Accetta** — vuoi lavorarci (passa a "Da fare")
- **Scarta** — non rilevante per ora
- **Fatto** — hai creato il contenuto corrispondente

Usa i filtri in cima per vedere brief **Attivi**, **Accettati**, **Fatti** o **Scartati**.

---

## Passo 9 — Chat AI Contestuale

Il tab **Chat AI** offre un assistente conversazionale che conosce il tuo portfolio.

L'assistente ha accesso a:
- Score AI e dimensioni del progetto
- Top 10 entità per frequenza
- Gap critici rilevati
- Contenuti più rilevanti alla tua domanda (ricerca semantica automatica)

Usalo per domande strategiche come:
- *"Quali contenuti dovrei creare prioritariamente?"*
- *"Come posso migliorare la dimensione Freschezza?"*
- *"Quali topic mancano rispetto ai competitor?"*
- *"Analizza i gap critici e suggerisci un piano d'azione"*

> La conversazione non viene salvata tra sessioni — ogni volta che ricarichi la pagina riparte da zero. Usa il bottone **Nuova chat** per resettare.

---

## Passo 10 — Ciclo di Miglioramento Continuo

Dopo aver analizzato i gap e prodotto i brief:

1. **Crea i nuovi contenuti** indicati dai brief (fuori dalla piattaforma, nel tuo CMS o blog)
2. **Aggiungili al progetto** (manuale o via Discovery)
3. **Approvali** e **scarica il testo**
4. **Riesegui l'analisi** — il badge "Score non aggiornato" ti avvisa quando serve
5. **Controlla il nuovo score** e i nuovi gap

Ogni ciclo dovrebbe ridurre i gap e far salire il punteggio.

---

## Sezioni del Dashboard

### `/dashboard`
Panoramica globale: KPI aggregati, tabella progetti con score, breakdown status contenuti, ultime analisi completate.

### `/content`
Inventory cross-progetto: tutti i contenuti di tutti i progetti in un'unica vista, filtrabile per progetto, status, piattaforma, tipo, testo.

### `/graph`
Knowledge graph interattivo: visualizza le entità come nodi (colore = tipo, dimensione = frequenza) e le co-occorrenze come archi. Seleziona il progetto dal dropdown. Utile per identificare a colpo d'occhio le entità più centrali e le relazioni mancanti.

---

## Consigli Pratici

- **Qualità > quantità**: 30 contenuti approvati e pertinenti valgono più di 200 generici
- **Approva con criterio**: includi solo contenuti che rappresentano genuinamente il brand
- **Scarica sempre il rawContent** prima di avviare l'analisi — senza testo non ci sono embeddings
- **Rigenera l'analisi** dopo ogni batch di nuovi contenuti approvati
- **Usa la Ricerca Semantica** per verificare la copertura prima di creare nuovi contenuti
- **Brief → contenuto → nuovo ciclo**: il valore aumenta con ogni iterazione
