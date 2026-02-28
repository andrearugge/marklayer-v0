/**
 * GET  /api/projects/:id/content/:contentId/suggestions  — fetch cached suggestions
 * POST /api/projects/:id/content/:contentId/suggestions  — generate (inline, single item)
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string; contentId: string }> };

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? "";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id: projectId, contentId } = await params;
  const project = await assertProjectOwnership(projectId, user.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const suggestion = await prisma.contentSuggestion.findUnique({
    where: { contentId },
  });

  return NextResponse.json({ data: suggestion });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: RouteParams
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id: projectId, contentId } = await params;
  const project = await assertProjectOwnership(projectId, user.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const item = await prisma.contentItem.findFirst({
    where: { id: contentId, projectId },
    include: {
      contentEntities: {
        include: { entity: { select: { label: true } } },
        orderBy: { salience: "desc" },
        take: 10,
      },
    },
  });

  if (!item) {
    return NextResponse.json(
      { error: { message: "Content not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  if (!item.rawContent) {
    return NextResponse.json(
      {
        error: {
          message: "Il contenuto non ha testo estratto. Estrai il testo prima di generare suggerimenti.",
          code: "NO_RAW_CONTENT",
        },
      },
      { status: 400 }
    );
  }

  const entities = item.contentEntities.map((ce) => ce.entity.label);

  // Call engine synchronously (inline generation, single item)
  let engineData: { id: string; suggestions: string[] } | null = null;
  try {
    const engineRes = await fetch(`${ENGINE_URL}/api/analyze/content-suggestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-engine-api-key": ENGINE_API_KEY,
      },
      body: JSON.stringify({
        id: contentId,
        title: item.title,
        text: item.rawContent.slice(0, 3000),
        entities,
        project_name: project.name,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!engineRes.ok) {
      const detail = await engineRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: {
            message: `Engine non disponibile (${engineRes.status}). Riprova tra qualche minuto.`,
            code: "ENGINE_ERROR",
            detail,
          },
        },
        { status: 502 }
      );
    }

    engineData = (await engineRes.json()) as { id: string; suggestions: string[] };
  } catch (err) {
    const isDown =
      err instanceof Error &&
      (err.message.includes("fetch failed") ||
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("TimeoutError"));
    return NextResponse.json(
      {
        error: {
          message: isDown
            ? "Il servizio AI non è raggiungibile. Assicurati che il motore sia avviato."
            : "Errore durante la generazione dei suggerimenti.",
          code: "ENGINE_UNAVAILABLE",
        },
      },
      { status: 502 }
    );
  }

  if (!engineData || engineData.suggestions.length === 0) {
    return NextResponse.json(
      {
        error: {
          message: "Il modello non ha restituito suggerimenti. Riprova.",
          code: "NO_SUGGESTIONS",
        },
      },
      { status: 500 }
    );
  }

  const now = new Date();
  const suggestion = await prisma.contentSuggestion.upsert({
    where: { contentId },
    update: {
      suggestions: engineData.suggestions,
      generatedAt: now,
      updatedAt: now,
    },
    create: {
      contentId,
      projectId,
      suggestions: engineData.suggestions,
      generatedAt: now,
    },
  });

  await logAuditEvent({
    action: AUDIT_ACTIONS.CONTENT_SUGGESTIONS_GENERATED,
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    targetId: contentId,
    metadata: { projectId, suggestionsCount: engineData.suggestions.length },
  });

  return NextResponse.json({ data: suggestion });
}
