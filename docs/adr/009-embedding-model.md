# ADR-009: Embedding Model — fastembed (ONNX locale)

**Data**: 2026-02-28
**Stato**: Accepted
**Deciders**: Andrea Ruggeri

---

## Contesto

Per generare embedding vettoriali dei content items (necessari per topic clustering e similarity search), dobbiamo scegliere tra un modello locale e un servizio API esterno.

I requisiti chiave sono:
- Supporto multilingua (italiano + inglese)
- Dimensione vettore ragionevole per pgvector (~300-400 dim)
- Nessun costo per request (o costo trascurabile per MVP)
- Integrabile nel servizio Python FastAPI esistente
- Docker image di dimensioni accettabili

---

## Opzioni Considerate

### Opzione A — `sentence-transformers` + PyTorch (CPU)
- Modello: `paraphrase-multilingual-MiniLM-L12-v2` (384 dim)
- Pro: ecosistema maturo, molto documentato
- **Contro**: PyTorch CPU ~800 MB–1 GB aggiunto all'immagine Docker

### Opzione B — `fastembed` (ONNX runtime)
- Modello: stesso `paraphrase-multilingual-MiniLM-L12-v2` (384 dim) via ONNX
- Pro: ~200 MB totale, nessun PyTorch, stessa API semantica, batch nativo
- Contro: libreria meno nota, subset di modelli supportati

### Opzione C — OpenAI `text-embedding-3-small` (API)
- 1536 dimensioni, qualità superiore
- Pro: nessun peso in Docker
- Contro: richiede `OPENAI_API_KEY`, $0.020/M tokens (costo trascurabile ma dipendenza esterna), latenza API

---

## Decisione

**Opzione B — fastembed** come default.

- Docker image rimane <500 MB totale
- Zero costo operativo
- Supporto italiano nativo
- Upgrade opzionale a OpenAI via env var `EMBEDDING_PROVIDER=openai` senza cambi architetturali

---

## Conseguenze

- `requirements.txt`: `fastembed==0.4.2` (include onnxruntime-cpu)
- Modello ONNX (~90 MB) scaricato al primo avvio → montare volume Docker `/root/.cache/huggingface/` per persistenza tra restart
- `EmbedderAgent` in `agents/embedder.py` con singleton lazy-loaded
- pgvector colonna: `vector(384)` — se in futuro si passa a OpenAI (1536 dim) serve migration
- Testo da embeddare: `title + ". " + rawContent[:2000]` (troncato per velocità, embedding cattura il senso principale)
