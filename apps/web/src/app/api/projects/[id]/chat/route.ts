/**
 * POST /api/projects/:id/chat
 * Streaming SSE proxy: builds context from DB, calls engine chat, forwards tokens.
 *
 * Body: { message: string; history?: {role, content}[] }
 * Streams: data: {"token": "..."}\n\n  …  data: [DONE]\n\n
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import type { SourcePlatform } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? "";

const BodySchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
});

// Platform authority weights (mirrors scoring.ts)
const PLATFORM_WEIGHT: Partial<Record<SourcePlatform, number>> = {
  NEWS: 100,
  SUBSTACK: 80,
  LINKEDIN: 80,
  MEDIUM: 70,
  WEBSITE: 60,
  TWITTER: 40,
};

function errorStream(message: string): Response {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          `data: ${JSON.stringify({ error: message })}\n\ndata: [DONE]\n\n`
        )
      );
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return errorStream("Non autenticato.");

  const { id: projectId } = await params;
  const project = await assertProjectOwnership(projectId, user.id);
  if (!project) return errorStream("Progetto non trovato.");

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return errorStream("Richiesta non valida.");

  const { message, history } = parsed.data;

  // ── Build context ────────────────────────────────────────────────────────────

  const [rawScore, topEntities, byPlatform, rawTopics, approvedCount] =
    await Promise.all([
      prisma.projectScore.findUnique({ where: { projectId } }),
      prisma.entity.findMany({
        where: { projectId, NOT: { type: "TOPIC" } },
        orderBy: { frequency: "desc" },
        take: 10,
        select: { label: true, type: true, frequency: true },
      }),
      prisma.contentItem.groupBy({
        by: ["sourcePlatform"],
        where: { projectId },
        _count: { _all: true },
      }),
      prisma.entity.findMany({
        where: { projectId, type: "TOPIC" },
        orderBy: { frequency: "desc" },
        take: 20,
        select: { label: true, frequency: true },
      }),
      prisma.contentItem.count({
        where: { projectId, status: "APPROVED" },
      }),
    ]);

  // Derive critical gaps (mirrors gap-analysis-card logic)
  const KEY_PLATFORMS: SourcePlatform[] = [
    "WEBSITE", "LINKEDIN", "MEDIUM", "SUBSTACK", "NEWS", "TWITTER",
  ];
  const platformsWithContent = new Set(byPlatform.map((r) => r.sourcePlatform));
  const recentGaps: string[] = [];

  // Missing key platforms
  KEY_PLATFORMS.filter((p) => !platformsWithContent.has(p)).forEach((p) => {
    recentGaps.push(`Nessun contenuto su ${p}`);
  });

  // Thin topics (< 3 items)
  rawTopics
    .filter((t) => t.frequency < 3)
    .slice(0, 2)
    .forEach((t) => recentGaps.push(`Topic poco coperto: "${t.label}"`));

  // Low-coverage entities (< 25% of approved)
  if (approvedCount >= 5) {
    topEntities
      .filter(
        (e) =>
          ["BRAND", "PERSON", "ORGANIZATION", "PRODUCT"].includes(e.type) &&
          e.frequency / approvedCount < 0.25
      )
      .slice(0, 2)
      .forEach((e) => recentGaps.push(`Entità poco menzionata: "${e.label}"`));
  }

  const top3Gaps = recentGaps.slice(0, 3);

  // ── Semantic search of user message (best-effort, ignore errors) ────────────

  let relevantContent: { title: string; excerpt: string | null; score: number }[] = [];

  try {
    const embedRes = await fetch(`${ENGINE_URL}/api/embed/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-engine-api-key": ENGINE_API_KEY,
      },
      body: JSON.stringify({ text: message }),
      signal: AbortSignal.timeout(8_000),
    });

    if (embedRes.ok) {
      const { embedding } = (await embedRes.json()) as { embedding: number[] };
      if (embedding?.length > 0) {
        const vectorLiteral = `[${embedding.join(",")}]`;
        const rows = await prisma.$queryRawUnsafe<
          { id: string; title: string; rawContent: string | null; distance: number }[]
        >(
          `SELECT id, title, "rawContent", (embedding <=> $1::vector) AS distance
           FROM content_items
           WHERE project_id = $2
             AND embedding IS NOT NULL
             AND status = 'APPROVED'
           ORDER BY distance
           LIMIT 3`,
          vectorLiteral,
          projectId
        );

        relevantContent = rows
          .filter((r) => Number(r.distance) < 0.7)
          .map((r) => ({
            title: r.title,
            excerpt: r.rawContent
              ? r.rawContent.slice(0, 200).trim() +
                (r.rawContent.length > 200 ? "…" : "")
              : null,
            score: Math.round((1 - Number(r.distance)) * 100),
          }));
      }
    }
  } catch {
    // silently skip — RAG context is best-effort
  }

  // ── Build engine request ────────────────────────────────────────────────────

  const dimensions = rawScore?.dimensions as
    | Record<string, number>
    | null
    | undefined;

  const enginePayload = {
    message,
    history,
    context: {
      project_name: project.name,
      overall_score: rawScore?.overallScore ?? null,
      dimensions: dimensions ?? null,
      top_entities: topEntities.map((e) => e.label),
      recent_gaps: top3Gaps,
      relevant_content: relevantContent,
    },
  };

  // ── Proxy SSE stream ─────────────────────────────────────────────────────────

  let engineRes: globalThis.Response;
  try {
    engineRes = await fetch(`${ENGINE_URL}/api/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-engine-api-key": ENGINE_API_KEY,
      },
      body: JSON.stringify(enginePayload),
      // No AbortSignal.timeout here — streaming response, let it flow
    });
  } catch {
    return errorStream("Servizio AI non raggiungibile.");
  }

  if (!engineRes.ok || !engineRes.body) {
    return errorStream(`Errore engine (${engineRes.status}).`);
  }

  // Forward engine SSE body directly to client
  return new Response(engineRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
