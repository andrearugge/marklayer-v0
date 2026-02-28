/**
 * AI Readiness Score — dimension computation (ADR-011)
 *
 * Calculates 5 scoring dimensions (0-100) from project content metadata:
 * Copertura (25%), Profondità (25%), Freschezza (20%), Autorevolezza (15%), Coerenza (15%).
 *
 * Accepts a PrismaClient instance so it can be used from both Next.js API
 * routes (singleton) and the standalone BullMQ worker (dedicated client).
 */

import type { PrismaClient } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreDimensions {
  copertura: number;   // Coverage:   diverse platforms & external sources
  profondita: number;  // Depth:      word count & extracted text coverage
  freschezza: number;  // Freshness:  recency of published content
  autorita: number;    // Authority:  platform quality weights
  coerenza: number;    // Coherence:  top entities distributed across content
}

export interface ScoreResult {
  dimensions: ScoreDimensions;
  overall: number;
  contentCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_WEIGHTS: Record<string, number> = {
  NEWS: 100,
  SUBSTACK: 80,
  LINKEDIN: 80,
  MEDIUM: 70,
  REDDIT: 60,
  WEBSITE: 60,
  YOUTUBE: 50,
  TWITTER: 40,
  QUORA: 40,
  OTHER: 30,
};

const SIX_MONTHS_MS  = 6  * 30 * 24 * 3_600_000;
const TWELVE_MONTHS_MS = 12 * 30 * 24 * 3_600_000;
const TWENTY_FOUR_MONTHS_MS = 24 * 30 * 24 * 3_600_000;

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function computeScoreDimensions(
  projectId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PrismaClient | any
): Promise<ScoreResult> {
  // ── Parallel data fetch ────────────────────────────────────────────────────
  const [
    platformGroups,
    totalAgg,
    wordCountAgg,
    freshnessDates,
    topEntities,
    totalApproved,
    rawContentCount,
  ] = await Promise.all([
    // Platform distribution (all items)
    db.contentItem.groupBy({
      by: ["sourcePlatform"],
      where: { projectId },
      _count: { id: true },
    }) as Promise<{ sourcePlatform: string; _count: { id: number } }[]>,

    // Total item count
    db.contentItem.aggregate({
      where: { projectId },
      _count: { id: true },
    }) as Promise<{ _count: { id: number } }>,

    // Avg word count (items with wordCount)
    db.contentItem.aggregate({
      where: { projectId, wordCount: { not: null } },
      _avg: { wordCount: true },
    }) as Promise<{ _avg: { wordCount: number | null } }>,

    // Published dates for freshness calculation
    db.contentItem.findMany({
      where: { projectId, publishedAt: { not: null } },
      select: { publishedAt: true },
    }) as Promise<{ publishedAt: Date | null }[]>,

    // Top 3 entities by frequency
    db.entity.findMany({
      where: { projectId },
      orderBy: { frequency: "desc" },
      take: 3,
      select: { id: true, frequency: true },
    }) as Promise<{ id: string; frequency: number }[]>,

    // Total APPROVED content items
    db.contentItem.count({ where: { projectId, status: "APPROVED" } }) as Promise<number>,

    // Items with extracted text
    db.contentItem.count({
      where: { projectId, rawContent: { not: null } },
    }) as Promise<number>,
  ]);

  const totalItems = totalAgg._count.id;

  // ── Copertura (Coverage) ───────────────────────────────────────────────────
  const uniquePlatforms = platformGroups.length;
  const externalCount = platformGroups
    .filter((g) => g.sourcePlatform !== "WEBSITE")
    .reduce((sum, g) => sum + g._count.id, 0);

  const piattaformePts = clamp((uniquePlatforms / 6) * 100);
  const sorgentiEsternePts = clamp((externalCount / Math.max(totalItems, 1)) * 100);
  const copertura = clamp(piattaformePts * 0.6 + sorgentiEsternePts * 0.4);

  // ── Profondità (Depth) ─────────────────────────────────────────────────────
  const avgWordCount = wordCountAgg._avg.wordCount ?? 0;
  const wordCountPts = clamp((avgWordCount / 800) * 100);
  const rawContentPts = clamp((rawContentCount / Math.max(totalItems, 1)) * 100);
  const profondita = clamp(wordCountPts * 0.5 + rawContentPts * 0.5);

  // ── Freschezza (Freshness) ────────────────────────────────────────────────
  const now = Date.now();
  let weightSum = 0;
  const itemsWithDate = freshnessDates.length;
  for (const item of freshnessDates) {
    const age = now - item.publishedAt!.getTime();
    let weight = 0;
    if (age < SIX_MONTHS_MS) weight = 1.0;
    else if (age < TWELVE_MONTHS_MS) weight = 0.5;
    else if (age < TWENTY_FOUR_MONTHS_MS) weight = 0.1;
    weightSum += weight;
  }
  const freschezza = itemsWithDate > 0 ? clamp((weightSum / itemsWithDate) * 100) : 0;

  // ── Autorevolezza (Authority) ─────────────────────────────────────────────
  let authoritySum = 0;
  let authorityCount = 0;
  for (const g of platformGroups) {
    const weight = PLATFORM_WEIGHTS[g.sourcePlatform] ?? 30;
    authoritySum += weight * g._count.id;
    authorityCount += g._count.id;
  }
  const autorita = authorityCount > 0 ? clamp(authoritySum / authorityCount) : 0;

  // ── Coerenza (Coherence) ──────────────────────────────────────────────────
  let coerenza = 0;
  if (topEntities.length > 0 && totalApproved > 0) {
    const presenceScores = await Promise.all(
      topEntities.map(async (entity) => {
        const count = (await db.contentEntity.count({
          where: { entityId: entity.id },
        })) as number;
        // 40% presence = 100 points
        return clamp((count / totalApproved / 0.4) * 100);
      })
    );
    coerenza = clamp(
      presenceScores.reduce((a: number, b: number) => a + b, 0) / presenceScores.length
    );
  }

  // ── Overall ───────────────────────────────────────────────────────────────
  const overall = clamp(
    copertura  * 0.25 +
    profondita * 0.25 +
    freschezza * 0.20 +
    autorita   * 0.15 +
    coerenza   * 0.15
  );

  return {
    dimensions: {
      copertura:  Math.round(copertura),
      profondita: Math.round(profondita),
      freschezza: Math.round(freschezza),
      autorita:   Math.round(autorita),
      coerenza:   Math.round(coerenza),
    },
    overall: Math.round(overall),
    contentCount: totalItems,
  };
}
