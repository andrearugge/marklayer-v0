# ADR-004: Development Environment — Docker Compose

**Status**: Accepted
**Date**: 2025-02-20

## Context

L'app dipende da servizi esterni: PostgreSQL, Redis, e in futuro il servizio Python FastAPI. Serve un modo consistente per avviare l'ambiente di sviluppo locale.

Le opzioni: Docker Compose, servizi installati localmente, Devcontainers, cloud dev environments (Gitpod, Codespaces).

## Decision

**Docker Compose** per i servizi di infrastruttura (PostgreSQL, Redis). L'app Next.js gira direttamente su Node.js locale (fuori da Docker) per DX ottimale (hot reload veloce, debugging nativo).

### Setup previsto

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: visiblee
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redis_data:/var/lib/redis/data

volumes:
  postgres_data:
  redis_data:
```

### Motivazioni

1. **Consistenza**: tutti gli sviluppatori hanno lo stesso PostgreSQL e Redis, stesse versioni
2. **pgvector incluso**: l'immagine `pgvector/pgvector:pg16` include l'estensione pre-installata
3. **Isolamento**: nessun conflitto con altri PostgreSQL/Redis sulla macchina
4. **Hot reload preservato**: Next.js gira su Node.js locale → fast refresh istantaneo
5. **Semplicità**: un solo `docker compose up -d` per avere tutto

### Deployment

La decisione sul deployment in produzione è **posticipata**. Le opzioni includono:
- Vercel (frontend) + Railway/Render (Python + DB + Redis)
- AWS ECS/Fargate con RDS e ElastiCache
- Self-hosted con Docker Compose (per early stage)

La scelta verrà fatta quando il prodotto sarà pronto per il deploy, basandosi su costi, scala attesa, e complessità operativa.

## Consequences

**Positive**:
- Setup locale in un comando
- Ambiente consistente
- pgvector disponibile immediatamente
- DX ottimale con hot reload nativo

**Negative**:
- Docker Desktop richiesto (risorse macchina)
- Possibili differenze sottili tra dev locale e produzione
- Il servizio Python (Fase 2+) richiederà configurazione aggiuntiva

**Mitigazioni**:
- Docker Desktop è standard per sviluppo moderno
- Le differenze dev/prod saranno minime con le stesse immagini
- Il servizio Python verrà aggiunto al docker-compose nella Fase 2
