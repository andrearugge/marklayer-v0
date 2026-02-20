# ADR-002: ORM — Prisma

**Status**: Accepted
**Date**: 2025-02-20

## Context

Serve un ORM per il layer Next.js che gestisca:
- Schema definition e migrations
- Query type-safe in TypeScript
- Integrazione con NextAuth (adapter ufficiale)
- Relazioni complesse (users → projects → content → embeddings)

Le opzioni considerate: Prisma, Drizzle ORM, TypeORM, raw SQL con query builder.

## Decision

**Prisma** come ORM principale.

### Motivazioni

1. **Schema declarativo**: `schema.prisma` è il single source of truth per il database. Leggibile, versionabile, diffabile.

2. **Migrations automatiche**: `prisma migrate dev` genera SQL migrations dallo schema diff. Nessun SQL manuale per le migrations standard.

3. **Type safety**: Prisma Client è generato dallo schema e fornisce autocompletamento e type checking completo. I tipi delle query si propagano automaticamente nel codice.

4. **NextAuth Adapter**: `@auth/prisma-adapter` è l'adapter ufficiale, mantenuto dal team NextAuth. Zero boilerplate per il modello auth.

5. **Prisma Studio**: UI web per esplorare e modificare i dati in development. Utile per debugging.

6. **Ecosystem**: estensioni per soft delete, audit log, multi-tenancy. Documentazione eccellente.

### Rispetto a Drizzle

Drizzle è più leggero e closer-to-SQL, con ottime performance. Tuttavia:
- L'adapter NextAuth per Drizzle è community-maintained
- Lo schema è definito in TypeScript (meno leggibile per non-dev)
- Le migrations richiedono più intervento manuale
- Per un team che potrebbe includere non-backend dev, la DX di Prisma è superiore

## Consequences

**Positive**:
- DX eccellente, velocità di sviluppo
- Type safety end-to-end
- Migrations gestite automaticamente
- Integrazione nativa con NextAuth

**Negative**:
- Prisma Client ha overhead rispetto a raw SQL per query complesse
- Alcune query avanzate (CTEs, window functions) richiedono `$queryRaw`
- Il Prisma Engine è un binary separato (impatto su cold starts in serverless)
- pgvector richiede un'estensione Prisma (`prisma-extension-pgvector` o raw queries)

**Mitigazioni**:
- Per le query del knowledge graph (ricorsive, CTE), useremo `$queryRaw` con tipi espliciti
- Per pgvector, valuteremo l'estensione Prisma o raw SQL a seconda della complessità
- Il deployment Docker (non serverless) mitiga il cold start del Prisma Engine
