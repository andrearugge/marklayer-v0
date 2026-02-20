# ADR-005: Fase 2 Split — CRUD Manuale prima, FastAPI dopo

**Status**: Accepted
**Date**: 2025-02-20

## Context

La Fase 2 (Content Discovery) comprende sia funzionalità CRUD semplici (gestione progetti e contenuti) sia funzionalità complesse che richiedono un servizio Python (web crawling, scraping, ricerca su piattaforme). Implementare tutto insieme introduce rischio: il servizio Python potrebbe bloccare lo sviluppo delle feature CRUD già pronte.

## Decision

Dividere la Fase 2 in due sotto-fasi:

**Fase 2a** (Next.js only):
- Modelli database per Projects e ContentItems
- CRUD completo per progetti
- Aggiunta manuale contenuti (singolo e CSV import)
- UI per gestione contenuti (lista, dettaglio, filtri, azioni bulk)

**Fase 2b** (aggiunge Python FastAPI):
- Scaffolding servizio Python
- Discovery Agent: web crawler
- Discovery Agent: ricerca su piattaforme via Google
- Content fetching e extraction
- Job orchestration con BullMQ
- Review UI per risultati discovery

## Consequences

**Positive**:
- L'utente può iniziare a usare il prodotto dopo la Fase 2a (valore immediato)
- La Fase 2a è testabile indipendentemente
- Il servizio Python può essere sviluppato con calma, senza bloccare il frontend
- Meno rischio di rework se l'architettura del discovery agent cambia

**Negative**:
- L'utente deve inserire contenuti manualmente fino alla Fase 2b
- Alcune UI (es. pagina progetto) potrebbero richiedere rework nella 2b per aggiungere il tab Discovery

**Mitigazioni**:
- La UI è progettata fin da subito per accogliere il tab Discovery (spazio riservato)
- Il CSV import nella 2a copre il caso di import bulk senza agent
