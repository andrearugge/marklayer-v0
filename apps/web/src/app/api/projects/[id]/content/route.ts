import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { CreateContentSchema, ContentQuerySchema } from "@/lib/validations/content";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

function computeHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
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

  const { searchParams } = new URL(req.url);
  const parsed = ContentQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    sourcePlatform: searchParams.get("sourcePlatform") ?? undefined,
    contentType: searchParams.get("contentType") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    sortBy: searchParams.get("sortBy") ?? undefined,
    sortOrder: searchParams.get("sortOrder") ?? undefined,
  });

  const { page, limit, status, sourcePlatform, contentType, search, sortBy, sortOrder } =
    parsed.success
      ? parsed.data
      : { page: 1, limit: 20, status: undefined, sourcePlatform: undefined, contentType: undefined, search: undefined, sortBy: "createdAt" as const, sortOrder: "desc" as const };

  const where: Prisma.ContentItemWhereInput = {
    projectId,
    ...(status ? { status } : {}),
    ...(sourcePlatform ? { sourcePlatform } : {}),
    ...(contentType ? { contentType } : {}),
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
  };

  const orderBy: Prisma.ContentItemOrderByWithRelationInput =
    sortBy === "title"
      ? { title: sortOrder }
      : sortBy === "publishedAt"
      ? { publishedAt: sortOrder }
      : { createdAt: sortOrder };

  const [items, total] = await Promise.all([
    prisma.contentItem.findMany({
      where,
      select: {
        id: true,
        title: true,
        url: true,
        sourcePlatform: true,
        contentType: true,
        status: true,
        discoveryMethod: true,
        wordCount: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contentItem.count({ where }),
  ]);

  return NextResponse.json({
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

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
      {
        error: {
          message: "Impossibile aggiungere contenuti a un progetto archiviato",
          code: "PROJECT_ARCHIVED",
        },
      },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = CreateContentSchema.safeParse(body);
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

  const { url, title, sourcePlatform, contentType, rawContent, publishedAt } =
    parsed.data;

  // Compute hash for dedup: prefer url, fall back to rawContent
  const hashSource = url || rawContent || null;
  const contentHash = hashSource ? computeHash(hashSource) : null;

  // Check duplicate within the same project
  if (contentHash) {
    const existing = await prisma.contentItem.findUnique({
      where: { projectId_contentHash: { projectId, contentHash } },
      select: { id: true, title: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: {
            message: "Questo contenuto è già presente nel progetto",
            code: "DUPLICATE_CONTENT",
          },
        },
        { status: 409 }
      );
    }
  }

  // Derive wordCount and excerpt from rawContent
  const wordCount = rawContent ? countWords(rawContent) : null;
  let excerpt = parsed.data.excerpt || null;
  if (!excerpt && rawContent) {
    excerpt = rawContent.slice(0, 200).trimEnd();
    if (rawContent.length > 200) excerpt += "…";
  }

  const item = await prisma.contentItem.create({
    data: {
      projectId,
      url: url || null,
      title,
      sourcePlatform,
      contentType,
      rawContent: rawContent || null,
      excerpt,
      contentHash,
      discoveryMethod: "MANUAL",
      wordCount,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
    },
    select: {
      id: true,
      title: true,
      url: true,
      sourcePlatform: true,
      contentType: true,
      status: true,
      discoveryMethod: true,
      wordCount: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  await logAuditEvent({
    action: AUDIT_ACTIONS.CONTENT_CREATED,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: item.id,
    metadata: { projectId, title, sourcePlatform, contentType },
  });

  return NextResponse.json({ data: item }, { status: 201 });
}
