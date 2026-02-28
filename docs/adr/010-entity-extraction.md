# ADR-010: Entity Extraction via Claude Haiku

**Data**: 2026-02-28
**Stato**: Accepted
**Deciders**: Andrea Ruggeri

---

## Contesto

Il Knowledge Graph richiede di estrarre entità nominate dai content items: persone, organizzazioni, brand, prodotti, luoghi, argomenti. Dobbiamo scegliere l'approccio di extraction.

---

## Opzioni Considerate

### Opzione A — spaCy / modelli NER locali
- Pro: nessuna API call, veloce, deterministico
- Contro: modelli italiani limitati (`it_core_news_lg`); entità custom (BRAND, TOPIC) non supportate nativamente; richiede fine-tuning per il dominio

### Opzione B — Claude Haiku con structured output (tool use)
- Pro: capisce il contesto, estrae tipi custom (BRAND, TOPIC), bilingua, nessun training
- Contro: costo per chiamata (trascurabile con Haiku), latenza ~1s per item
- Costo stimato: ~0.25$ per 1000 content items (Haiku input+output ~500 token/item)

### Opzione C — Approccio ibrido (spaCy + Haiku solo per BRAND/TOPIC)
- Maggiore complessità per MVP

---

## Decisione

**Opzione B — Claude Haiku** per tutti i tipi di entità.

- Unico codice path, nessun modello locale aggiuntivo
- Qualità superiore su testo italiano e content marketing
- Costo Haiku accettabile per volumi MVP (< 10.000 items)
- Già presente `anthropic` in `requirements.txt`

---

## Schema Output

Tool use / structured JSON per ogni content item:
```json
{
  "entities": [
    {
      "label": "Mario Rossi",
      "type": "PERSON",
      "salience": 0.9,
      "context": "...intervista a Mario Rossi, fondatore di..."
    },
    {
      "label": "Visiblee",
      "type": "BRAND",
      "salience": 1.0,
      "context": null
    }
  ]
}
```

Tipi supportati: `BRAND | PERSON | ORGANIZATION | TOPIC | PRODUCT | LOCATION | CONCEPT | OTHER`

---

## Conseguenze

- `agents/extractor.py`: `EntityExtractorAgent` con Anthropic async client
- 1 chiamata LLM per content item (semplice, non batch multi-item) — revisione se costi salgono
- Normalizzazione: `label.strip().lower()` per dedup in DB (`normalizedLabel`)
- `frequency` sull'Entity: incrementato quando la stessa entità appare in un nuovo content item
- Retry su status 429/529: exponential backoff 2^attempt (max 3 retry)
- Solo content items con `rawContent IS NOT NULL` e `status = APPROVED` vengono processati
