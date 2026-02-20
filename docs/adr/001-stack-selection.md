# ADR-001: Stack Selection

**Status**: Accepted
**Date**: 2025-02-20
**Decision makers**: Project Owner + AI Architect

## Context

Stiamo costruendo una web app SaaS che combina:
- Un frontend ricco con dashboard, visualizzazioni graph, e interfaccia conversazionale
- API CRUD per gestione utenti, progetti, contenuti
- Task AI-intensive: web crawling, NLP, embedding generation, LLM interaction
- Knowledge graph e analisi semantica
- Job asincroni di lunga durata

Serve uno stack che bilanci DX (developer experience), performance, e adeguatezza all'ecosistema AI/ML.

## Decision

### Frontend + API: Next.js 14+ (App Router)

- Server Components per performance e SEO
- API Routes per gli endpoint REST
- Middleware per auth e route protection
- Ecosystem maturo, ottima documentazione

### UI: shadcn/ui + Tailwind CSS

- Componenti accessibili basati su Radix UI
- Fully customizable (non locked-in come Material UI)
- Tailwind per utility-first styling
- Ottimo per dashboard e data-heavy UI

### AI Service: Python FastAPI (servizio separato)

**Motivazione chiave**: l'ecosistema AI/ML è Python-first. Librerie come spaCy, networkx, sentence-transformers, langchain, BeautifulSoup sono tutte Python. Mantenere il processing AI in un servizio separato:
- Permette di usare le librerie native senza bridge
- Scala indipendentemente dal frontend
- Isola i failure dei task pesanti dal servizio web
- Permette team diversi di lavorare in parallelo

### LLM: Claude API (Anthropic) con adapter pattern

- Claude come provider primario per analisi e generazione
- Adapter pattern per poter aggiungere OpenAI, Gemini in futuro
- Nessun lock-in su un singolo provider

### Job Queue: BullMQ + Redis

- Job tracking, retry, priorità
- Dashboard di monitoring (Bull Board)
- Maturità e affidabilità comprovate

## Consequences

**Positive**:
- Ogni tecnologia è best-in-class per il suo dominio
- Separazione chiara delle responsabilità
- Scalabilità indipendente dei servizi
- Ecosistema Python completo per AI/ML

**Negative**:
- Due runtime da gestire (Node.js + Python)
- Comunicazione inter-servizio aggiunge latenza
- Docker Compose necessario anche in dev locale
- Più complessità operativa rispetto a un monolite

**Mitigazioni**:
- Docker Compose semplifica il setup locale
- Le API tra i servizi sono semplici e ben definite
- Il servizio Python è stateless e può essere sostituito/scalato facilmente
