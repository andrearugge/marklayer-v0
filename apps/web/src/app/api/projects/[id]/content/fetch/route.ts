import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

// Max URLs sent to the engine per batch
const BATCH_SIZE = 20;

// ─── Engine response types ────────────────────────────────────────────────────

interface EngineExtractResult {
  url: string;
  title: string | null;
  raw_content: string | null;
  word_count: number | null;
  excerpt: string | null;
  published_at: string | null;
  error: string | null;
}

interface EngineExtractResponse {
  results: EngineExtractResult[];
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id: projectId } = await params;
  const project = await assertProjectOwnership(projectId, currentUser.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  if (project.status === "ARCHIVED") {
    return NextResponse.json(
      { error: { message: "Cannot fetch content for an archived project", code: "PROJECT_ARCHIVED" } },
      { status: 400 }
    );
  }

  // Find items that have a URL but no extracted content yet
  const items = await prisma.contentItem.findMany({
    where: {
      projectId,
      url: { not: null },
      rawContent: null,
      status: { not: "REJECTED" },
    },
    select: { id: true, url: true },
  });

  if (items.length === 0) {
    return NextResponse.json({
      data: { fetched: 0, errors: 0, skipped: 0, message: "No items need fetching" },
    });
  }

  const engineUrl = process.env.ENGINE_URL ?? "http://localhost:8000";
  const engineApiKey = process.env.ENGINE_API_KEY ?? "";

  let fetched = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const urls = batch.map((item) => item.url as string);

    let engineData: EngineExtractResponse;
    try {
      const engineRes = await fetch(`${engineUrl}/api/crawl/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-engine-api-key": engineApiKey,
        },
        body: JSON.stringify({ urls, concurrency: 5 }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!engineRes.ok) {
        // Skip this batch on engine error, count all as errors
        errors += batch.length;
        continue;
      }

      engineData = (await engineRes.json()) as EngineExtractResponse;
    } catch {
      errors += batch.length;
      continue;
    }

    // Build a url → result map for fast lookup
    const resultByUrl = new Map<string, EngineExtractResult>(
      engineData.results.map((r) => [r.url, r])
    );

    // Update each item individually
    await Promise.all(
      batch.map(async (item) => {
        const result = resultByUrl.get(item.url as string);
        if (!result || result.error || !result.raw_content) {
          errors++;
          return;
        }

        await prisma.contentItem.update({
          where: { id: item.id },
          data: {
            rawContent: result.raw_content,
            wordCount: result.word_count ?? null,
            excerpt: result.excerpt ?? null,
            lastCrawledAt: new Date(),
            ...(result.published_at
              ? { publishedAt: new Date(result.published_at) }
              : {}),
          },
        });
        fetched++;
      })
    );
  }

  await logAuditEvent({
    action: AUDIT_ACTIONS.CONTENT_FETCHED,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: projectId,
    metadata: {
      total: items.length,
      fetched,
      errors,
    },
  });

  return NextResponse.json({
    data: {
      total: items.length,
      fetched,
      errors,
    },
  });
}
