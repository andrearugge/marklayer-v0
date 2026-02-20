import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { UpdateContentSchema } from "@/lib/validations/content";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string; contentId: string }> };

const ITEM_SELECT = {
  id: true,
  title: true,
  url: true,
  sourcePlatform: true,
  contentType: true,
  rawContent: true,
  excerpt: true,
  contentHash: true,
  discoveryMethod: true,
  status: true,
  wordCount: true,
  language: true,
  publishedAt: true,
  lastCrawledAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function resolveItem(projectId: string, contentId: string) {
  return prisma.contentItem.findFirst({
    where: { id: contentId, projectId },
    select: ITEM_SELECT,
  });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id: projectId, contentId } = await params;
  const project = await assertProjectOwnership(projectId, currentUser.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const item = await resolveItem(projectId, contentId);
  if (!item) {
    return NextResponse.json(
      { error: { message: "Content not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: item });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id: projectId, contentId } = await params;
  const project = await assertProjectOwnership(projectId, currentUser.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const existing = await resolveItem(projectId, contentId);
  if (!existing) {
    return NextResponse.json(
      { error: { message: "Content not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const body = await req.json();
  const parsed = UpdateContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: "Dati non validi",
          code: "INVALID_DATA",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { title, url, sourcePlatform, contentType, rawContent, excerpt, publishedAt, status } =
    parsed.data;

  // Recalculate derived fields if rawContent is being updated
  let newWordCount = existing.wordCount;
  let newExcerpt = excerpt !== undefined ? excerpt || null : existing.excerpt;

  if (rawContent !== undefined) {
    newWordCount = rawContent ? countWords(rawContent) : null;
    if (excerpt === undefined) {
      if (rawContent) {
        newExcerpt = rawContent.slice(0, 200).trimEnd();
        if (rawContent.length > 200) newExcerpt += "…";
      } else {
        newExcerpt = null;
      }
    }
  }

  const updated = await prisma.contentItem.update({
    where: { id: contentId },
    data: {
      ...(title !== undefined && { title }),
      ...(url !== undefined && { url: url || null }),
      ...(sourcePlatform !== undefined && { sourcePlatform }),
      ...(contentType !== undefined && { contentType }),
      ...(rawContent !== undefined && { rawContent: rawContent || null }),
      ...(status !== undefined && { status }),
      ...(publishedAt !== undefined && {
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      }),
      wordCount: newWordCount,
      excerpt: newExcerpt,
    },
    select: ITEM_SELECT,
  });

  await logAuditEvent({
    action: AUDIT_ACTIONS.CONTENT_UPDATED,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: contentId,
    metadata: { projectId, changes: parsed.data },
  });

  return NextResponse.json({ data: updated });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id: projectId, contentId } = await params;
  const project = await assertProjectOwnership(projectId, currentUser.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const item = await resolveItem(projectId, contentId);
  if (!item) {
    return NextResponse.json(
      { error: { message: "Content not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  await prisma.contentItem.delete({ where: { id: contentId } });

  await logAuditEvent({
    action: AUDIT_ACTIONS.CONTENT_DELETED,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: contentId,
    metadata: { projectId, title: item.title },
  });

  return NextResponse.json({ data: { id: contentId } });
}
