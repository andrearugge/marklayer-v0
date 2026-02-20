# ADR-006: Content Discovery — Librerie Proprie + Google Search

**Status**: Accepted
**Date**: 2025-02-20

## Context

La piattaforma deve trovare i contenuti dell'utente su diverse piattaforme: sito web, Substack, Medium, LinkedIn, Reddit, YouTube, testate giornalistiche. Serve sia un meccanismo di crawling (per il sito dell'utente) sia un meccanismo di ricerca (per contenuti su piattaforme terze).

### Opzioni Crawling
1. **API esterne** (Firecrawl, ScrapingBee): meno codice, costo per request
2. **Librerie proprie**: Cheerio + Puppeteer (Node.js) o BeautifulSoup + Playwright (Python)

### Opzioni Platform Discovery
1. **API ufficiali** per ogni piattaforma: affidabili ma N integrazioni da mantenere
2. **Google Search** (`site:platform.com "nome"`): un solo meccanismo per tutte le piattaforme
3. **Mix**: API dove disponibili, Google come fallback

## Decision

### Crawling: Librerie proprie
- **Python (nel servizio FastAPI)**: `httpx` per HTTP + `BeautifulSoup` per parsing HTML
- **Fallback per SPA**: `Playwright` per pagine che richiedono rendering JavaScript
- Nessuna dipendenza da servizi esterni a pagamento

### Platform Discovery: Google Search unificato
- Tutte le piattaforme vengono cercate via Google con query `site:` specifiche
- Implementazione: Google Custom Search JSON API (100 query/giorno gratis, poi $5/1000)
- Un solo meccanismo di ricerca → una sola integrazione da mantenere

### Query Templates

| Piattaforma | Query Template |
|-------------|---------------|
| Website | `site:domain.com` |
| Substack | `site:substack.com "nome autore"` |
| Medium | `site:medium.com "nome autore"` |
| LinkedIn | `site:linkedin.com/pulse "nome autore"` |
| Reddit | `site:reddit.com "nome autore" OR "brand"` |
| YouTube | `site:youtube.com "nome canale"` |
| News/Menzioni | `"nome brand" -site:domain.com` |

## Consequences

**Positive**:
- Controllo completo sul crawling (nessun vendor lock-in)
- Costo zero per il crawling del sito utente
- Un solo meccanismo per il discovery su tutte le piattaforme
- Manutenzione semplificata (una integrazione, non N)

**Negative**:
- Più codice da scrivere e mantenere per il crawler
- Puppeteer/Playwright in Docker richiede Chromium headless (~400MB)
- Google Custom Search ha limiti (100 query/giorno free tier)
- I risultati Google potrebbero non essere completi (non tutto è indicizzato)
- Alcune piattaforme (LinkedIn) hanno protezioni anti-scraping

**Mitigazioni**:
- Cheerio copre l'80% dei casi (siti statici); Playwright solo per SPA
- Il free tier di Google CSE è sufficiente per utenti singoli; upgrade se necessario
- L'utente può sempre aggiungere contenuti manualmente se il discovery non li trova
- Per LinkedIn: focus su articoli pubblici (/pulse/), non profili privati
