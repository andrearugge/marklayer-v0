/**
 * AI Readiness Score — suggestion generation
 *
 * Calls the Python engine to generate actionable suggestions for weak dimensions.
 * Falls back to static suggestions if the engine is unavailable.
 */

import type { ScoreDimensions } from "./scoring";

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? "";

// ─── Static fallbacks (Italian) ───────────────────────────────────────────────

const STATIC_FALLBACKS: Record<string, string> = {
  copertura:
    "Espandi la presenza su più piattaforme (Substack, LinkedIn, Medium) per aumentare la copertura.",
  profondita:
    "Aumenta la lunghezza media degli articoli a 600+ parole per migliorare la profondità dei contenuti.",
  freschezza:
    "Pubblica nuovi contenuti regolarmente per mantenere aggiornata la knowledge base del brand.",
  autorita:
    "Punta a ottenere menzioni su testate giornalistiche e blog professionali per aumentare l'autorevolezza.",
  coerenza:
    "Assicurati che i concetti chiave del brand appaiano trasversalmente su tutti i contenuti.",
};

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateSuggestions(
  projectName: string,
  dimensions: ScoreDimensions
): Promise<string[]> {
  // Identify weak dimensions (score < 60), sorted by score ascending
  const weakDimensions = (
    Object.entries(dimensions) as [keyof ScoreDimensions, number][]
  )
    .filter(([, v]) => v < 60)
    .sort((a, b) => a[1] - b[1])
    .map(([name, value]) => ({ name, value }));

  if (weakDimensions.length === 0) {
    return ["Ottimo lavoro! Continua a mantenere aggiornati i contenuti per un punteggio ottimale."];
  }

  // Try engine suggestions
  try {
    const res = await fetch(`${ENGINE_URL}/api/analyze/suggestions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-engine-api-key": ENGINE_API_KEY,
      },
      body: JSON.stringify({
        project_name: projectName,
        dimensions,
        weak_dimensions: weakDimensions,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (res.ok) {
      const data = (await res.json()) as { suggestions: string[] };
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        return data.suggestions;
      }
    }
  } catch {
    // Engine unavailable — fall through to static suggestions
  }

  // Static fallback: one suggestion per weak dimension (up to 5)
  return weakDimensions
    .slice(0, 5)
    .map((d) => STATIC_FALLBACKS[d.name] ?? `Migliora la dimensione "${d.name}" del tuo brand.`);
}
