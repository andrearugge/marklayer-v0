import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { BulkActionSchema } from "@/lib/validations/content";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";
import type { Prisma, SourcePlatform, ContentType, ContentStatus } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

const STATUS_MAP = {
  approve: "APPROVED",
  reject: "REJECTED",
  archive: "ARCHIVED",
} as const;

// Max URLs sent to the engine per batch
const BATCH_SIZE = 20;

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

// Build a Prisma where clause from bulk filters
function buildWhereFromFilters(
  projectId: string,
  filters?: {
    status?: string;
    sourcePlatform?: string;
    contentType?: string;
    search?: string;
    fetchStatus?: string;
  }
): Prisma.ContentItemWhereInput {
  const where: Prisma.ContentItemWhereInput = { projectId };
  if (!filters) return where;

  if (filters.status) where.status = filters.status as ContentStatus;
  if (filters.sourcePlatform) where.sourcePlatform = filters.sourcePlatform as SourcePlatform;
  if (filters.contentType) where.contentType = filters.contentType as ContentType;
  if (filters.search) where.title = { contains: filters.search, mode: "insensitive" };

  if (filters.fetchStatus === "fetched") {
    where.rawContent = { not: null };
  } else if (filters.fetchStatus === "pending") {
    where.rawContent = null;
    where.fetchError = null;
    where.url = { not: null };
  } else if (filters.fetchStatus === "error") {
    where.fetchError = { not: null };
  }

  return where;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
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

  const body = await req.json();
  const parsed = BulkActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: parsed.error.issues[0]?.message ?? "Dati non validi",
          code: "INVALID_DATA",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { ids, selectAll, filters, action } = parsed.data;

  // ── Build the where clause ───────────────────────────────────────────────────

  let where: Prisma.ContentItemWhereInput;

  if (selectAll) {
    where = buildWhereFromFilters(projectId, filters);
  } else {
    const safeIds = ids!;
    // Verify all IDs belong to this project
    const ownedCount = await prisma.contentItem.count({
      where: { id: { in: safeIds }, projectId },
    });
    if (ownedCount !== safeIds.length) {
      return NextResponse.json(
        {
          error: {
            message: "Uno o più contenuti non appartengono a questo progetto",
            code: "FORBIDDEN",
          },
        },
        { status: 403 }
      );
    }
    where = { id: { in: safeIds }, projectId };
  }

  // ── Execute action ───────────────────────────────────────────────────────────

  let count = 0;

  if (action === "delete") {
    const result = await prisma.contentItem.deleteMany({ where });
    count = result.count;

    await logAuditEvent({
      action: AUDIT_ACTIONS.CONTENT_BULK_ACTION,
      actorId: currentUser.id,
      actorEmail: currentUser.email ?? undefined,
      targetId: projectId,
      metadata: { action, count, selectAll: selectAll ?? false },
    });

    await prisma.projectScore.updateMany({
      where: { projectId },
      data: { isStale: true },
    });

    return NextResponse.json({ data: { count, action } });
  }

  if (action === "fetch") {
    // Restrict to items that have a URL but no rawContent yet
    const fetchWhere: Prisma.ContentItemWhereInput = {
      ...where,
      url: { not: null },
      rawContent: null,
    };
    const items = await prisma.contentItem.findMany({
      where: fetchWhere,
      select: { id: true, url: true },
    });

    if (items.length === 0) {
      return NextResponse.json({ data: { count: 0, errors: 0 } });
    }

    const engineUrl = process.env.ENGINE_URL ?? "http://localhost:8000";
    const engineApiKey = process.env.ENGINE_API_KEY ?? "";
    let fetched = 0;
    let errors = 0;

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
          await Promise.all(
            batch.map((item) =>
              prisma.contentItem.update({
                where: { id: item.id },
                data: { fetchError: `Engine error ${engineRes.status}` },
              })
            )
          );
          errors += batch.length;
          continue;
        }

        engineData = (await engineRes.json()) as EngineExtractResponse;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Engine non raggiungibile";
        await Promise.all(
          batch.map((item) =>
            prisma.contentItem.update({
              where: { id: item.id },
              data: { fetchError: msg },
            })
          )
        );
        errors += batch.length;
        continue;
      }

      const resultByUrl = new Map<string, EngineExtractResult>(
        engineData.results.map((r) => [r.url, r])
      );

      await Promise.all(
        batch.map(async (item) => {
          const result = resultByUrl.get(item.url as string);
          if (!result || result.error || !result.raw_content) {
            const errorMsg =
              result?.error ?? "Contenuto non estratto o URL non raggiungibile";
            await prisma.contentItem.update({
              where: { id: item.id },
              data: { fetchError: errorMsg },
            });
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
              fetchError: null,
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
      action: AUDIT_ACTIONS.CONTENT_BULK_ACTION,
      actorId: currentUser.id,
      actorEmail: currentUser.email ?? undefined,
      targetId: projectId,
      metadata: { action: "fetch", fetched, errors, selectAll: selectAll ?? false },
    });

    return NextResponse.json({ data: { count: fetched, errors, action } });
  }

  // approve | reject | archive
  const result = await prisma.contentItem.updateMany({
    where,
    data: { status: STATUS_MAP[action as keyof typeof STATUS_MAP] },
  });
  count = result.count;

  await logAuditEvent({
    action: AUDIT_ACTIONS.CONTENT_BULK_ACTION,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: projectId,
    metadata: { action, count, selectAll: selectAll ?? false },
  });

  await prisma.projectScore.updateMany({
    where: { projectId },
    data: { isStale: true },
  });

  return NextResponse.json({ data: { count, action } });
}
