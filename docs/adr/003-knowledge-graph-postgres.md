# ADR-003: Knowledge Graph — PostgreSQL-only

**Status**: Accepted
**Date**: 2025-02-20

## Context

Il knowledge graph è un componente core della piattaforma: mappa entità, topic, relazioni semantiche dei contenuti dell'utente. Serve per:
- Visualizzare la struttura della presenza digitale
- Identificare cluster tematici e gap
- Calcolare coerenza semantica cross-platform
- Supportare l'AI Readiness scoring

Le opzioni: Neo4j (graph DB nativo), PostgreSQL con tabelle nodi/edges, Amazon Neptune.

## Decision

**PostgreSQL con tabelle nodi/edges** per l'MVP. Rivalutazione verso Neo4j post-MVP se necessario.

### Schema previsto

```sql
-- Nodi del graph
graph_nodes (
  id          UUID PRIMARY KEY,
  project_id  UUID REFERENCES projects(id),
  node_type   ENUM('entity', 'topic', 'content', 'platform', 'query'),
  label       VARCHAR,
  properties  JSONB,        -- dati flessibili specifici per tipo
  embedding   VECTOR(1536), -- per similarità semantica
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
)

-- Edges del graph
graph_edges (
  id          UUID PRIMARY KEY,
  project_id  UUID REFERENCES projects(id),
  source_id   UUID REFERENCES graph_nodes(id),
  target_id   UUID REFERENCES graph_nodes(id),
  edge_type   ENUM('covers_topic', 'mentions_entity', 'published_on', 'related_to', 'derived_from'),
  weight      FLOAT,        -- forza della relazione
  properties  JSONB,
  created_at  TIMESTAMPTZ
)

-- Indici
CREATE INDEX idx_nodes_project_type ON graph_nodes(project_id, node_type);
CREATE INDEX idx_edges_source ON graph_edges(source_id);
CREATE INDEX idx_edges_target ON graph_edges(target_id);
CREATE INDEX idx_edges_project_type ON graph_edges(project_id, edge_type);
```

### Query pattern principali

1. **Nodi adiacenti**: `SELECT * FROM graph_edges WHERE source_id = ? OR target_id = ?`
2. **Subgraph per topic**: JOIN filtrato su `node_type` e `edge_type`
3. **Traversal profondo**: `WITH RECURSIVE` per path multi-hop (raro nell'MVP, max 3-4 hop)
4. **Similarità**: query pgvector per nodi semanticamente vicini

### Motivazioni

1. **Un solo database**: nessun servizio aggiuntivo da gestire, configurare, backuppare
2. **Transazioni ACID**: le operazioni sul graph sono transazionali con il resto dei dati
3. **pgvector integrato**: embedding search nello stesso database
4. **Sufficiente per l'MVP**: il graph dell'utente singolo avrà centinaia, al massimo qualche migliaio di nodi. PostgreSQL gestisce questa scala senza problemi.
5. **Prisma compatible**: le tabelle nodi/edges sono modelli Prisma standard

### Soglia di rivalutazione

Considereremo Neo4j se:
- Le query ricorsive diventano il bottleneck (>500ms per traversal)
- Servono algoritmi graph nativi (PageRank, community detection, shortest path) con frequenza
- Il graph supera le decine di migliaia di nodi per utente
- Le query diventano troppo complesse da esprimere in SQL

## Consequences

**Positive**:
- Zero complessità operativa aggiuntiva
- Sviluppo più veloce (Prisma, un solo DB)
- Embedding e graph nello stesso database
- Costi inferiori

**Negative**:
- Query graph complesse sono verbose in SQL
- Nessun algoritmo graph nativo (PageRank, etc.) senza implementazione manuale
- Traversal profondi (>4 hop) sono lenti con CTE ricorsive
- Se il graph cresce molto, la migrazione a Neo4j richiede lavoro

**Mitigazioni**:
- Utility functions per le query graph più comuni (adjacency, subgraph)
- Per algoritmi graph complessi, il servizio Python può usare networkx in-memory
- Schema graph astratto dietro un repository pattern per facilitare eventuale migrazione
