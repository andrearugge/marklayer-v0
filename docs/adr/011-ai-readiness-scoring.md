# ADR-011: AI Readiness Score — Formula e Architettura

**Data**: 2026-02-28
**Stato**: Accepted
**Deciders**: Andrea Ruggeri

---

## Contesto

Il prodotto deve fornire un "AI Readiness Score" che misura quanto un brand è ben rappresentato per essere compreso e citato dai modelli linguistici (ChatGPT, Claude, Perplexity, ecc.).

Dobbiamo definire: (1) le dimensioni del punteggio, (2) dove viene calcolato, (3) come vengono generate le suggestions.

---

## Cosa misura l'AI Readiness Score

Un LLM "conosce" un brand se:
- Esistono **molte fonti diverse** che lo menzionano (copertura)
- Il contenuto disponibile è **denso e dettagliato** (profondità)
- Le informazioni sono **recenti** (freschezza)
- Le fonti sono **autorevoli** (news, blog professionali > social post casuali)
- I concetti chiave sono **consistentemente** associati al brand su più fonti

---

## Dimensioni e Formule (score 0–100 per dimensione)

### Copertura (peso 25%)
Misura la diversità delle fonti.

```
piattaformePts = min(100, uniquePlatforms * (100 / 6))   # 6 piattaforme = 100
sorgentiEsternePts = (externalItems / max(totalItems, 1)) * 100
copertura = (piattaformePts * 0.6) + (sorgentiEsternePts * 0.4)
```
Dove "sorgenti esterne" = contenuti con `sourcePlatform != WEBSITE`.

### Profondità (peso 25%)
Misura la ricchezza del contenuto disponibile.

```
wordCountPts = min(100, (avgWordCount / 800) * 100)     # target 800 parole
rawContentPts = (itemsWithRawContent / max(totalItems, 1)) * 100
profondita = (wordCountPts * 0.5) + (rawContentPts * 0.5)
```

### Freschezza (peso 20%)
Misura la recency del contenuto.

```
# Per ogni contenuto con publishedAt:
weight = 1.0  se < 6 mesi fa
weight = 0.5  se < 12 mesi fa
weight = 0.1  se < 24 mesi fa
weight = 0.0  se oltre 24 mesi o publishedAt nullo

freschezza = (sum(weights) / max(itemsWithDate, 1)) * 100
```

### Autorevolezza (peso 15%)
Misura il peso delle piattaforme usate.

```
PLATFORM_WEIGHTS = {
  NEWS: 100, SUBSTACK: 80, LINKEDIN: 80,
  MEDIUM: 70, REDDIT: 60, WEBSITE: 60,
  YOUTUBE: 50, TWITTER: 40, QUORA: 40, OTHER: 30
}
autorita = media(PLATFORM_WEIGHTS[item.sourcePlatform] per ogni item APPROVED)
```

### Coerenza (peso 15%)
Misura quanto le entità chiave sono distribuite tra i contenuti.

```
# Top 3 entità per frequency nel progetto
# Per ognuna: in quanti contenuti APPROVED appare?
presenzaRatio = count(contentItems dove entity appare) / count(totalApproved)
coerenza = media(min(100, presenzaRatio * 100 / 0.4) per top-3 entity)
# 0.4 = 40% threshold = score 100; se nessuna entity estratta → 0
```

### Overall Score
```
overall = copertura*0.25 + profondita*0.25 + freschezza*0.20 + autorita*0.15 + coerenza*0.15
```

---

## Architettura del Calcolo

**Scelta: calcolo in Next.js (TypeScript + Prisma), NON nel Python engine.**

Motivazione: le 5 dimensioni sono aggregati SQL puri — più efficiente eseguirli vicino al DB che fare un roundtrip engine. Il Python engine è necessario solo per le suggestions (LLM call).

```
POST /api/projects/:id/analysis/score
  → lib/scoring.ts computeScoreDimensions(projectId)  [5 query Prisma in parallelo]
  → POST engine /api/analyze/suggestions               [solo se una dimensione < 60]
  → upsert ProjectScore
```

**Suggestions**: Claude Haiku, input = {projectName, dimensions, weakDimensions}, output = `string[]` (3-5 azioni concrete in italiano). Fallback statico se engine non disponibile.

---

## Stale Detection

`ProjectScore.isStale = true` viene impostato quando:
- Viene aggiunto/importato un nuovo content item
- Un content item cambia status a `APPROVED` o viene eliminato
- Viene completato un nuovo discovery job

L'UI mostra badge "Score non aggiornato" se `isStale = true` o se `computedAt` è più vecchio di 7 giorni.

---

## Conseguenze

- `lib/scoring.ts`: funzione `computeScoreDimensions()` con 5 query parallele
- `lib/suggestions.ts`: funzione `generateSuggestions()` con fallback
- `api/analyze.py` engine: endpoint `POST /api/analyze/suggestions`
- `model ProjectScore` in schema Prisma con `isStale: Boolean`
- Hook in `PATCH /content/bulk` e `POST /content` per impostare `isStale = true`
