import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UpdateProjectSchema } from "@/lib/validations/project";
import { assertProjectOwnership } from "@/lib/projects";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  // Fetch stats in parallel
  const [totalCount, byPlatform, byType, byStatus] = await Promise.all([
    prisma.contentItem.count({ where: { projectId: id } }),
    prisma.contentItem.groupBy({
      by: ["sourcePlatform"],
      where: { projectId: id },
      _count: { _all: true },
    }),
    prisma.contentItem.groupBy({
      by: ["contentType"],
      where: { projectId: id },
      _count: { _all: true },
    }),
    prisma.contentItem.groupBy({
      by: ["status"],
      where: { projectId: id },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    data: {
      ...project,
      _count: { contentItems: totalCount },
      stats: {
        byPlatform: Object.fromEntries(
          byPlatform.map((r) => [r.sourcePlatform, r._count._all])
        ),
        byType: Object.fromEntries(
          byType.map((r) => [r.contentType, r._count._all])
        ),
        byStatus: Object.fromEntries(
          byStatus.map((r) => [r.status, r._count._all])
        ),
      },
    },
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const body = await req.json();
  const parsed = UpdateProjectSchema.safeParse(body);
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

  const { name, description, domain, status } = parsed.data;

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description: description || null }),
      ...(domain !== undefined && { domain: domain || null }),
      ...(status !== undefined && { status }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      domain: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await logAuditEvent({
    action: AUDIT_ACTIONS.PROJECT_UPDATED,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: id,
    metadata: { projectName: updated.name, changes: parsed.data },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  if (project.status === "ARCHIVED") {
    return NextResponse.json(
      { error: { message: "Project is already archived", code: "ALREADY_ARCHIVED" } },
      { status: 400 }
    );
  }

  const archived = await prisma.project.update({
    where: { id },
    data: { status: "ARCHIVED" },
    select: { id: true, name: true, status: true },
  });

  await logAuditEvent({
    action: AUDIT_ACTIONS.PROJECT_ARCHIVED,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: id,
    metadata: { projectName: project.name },
  });

  return NextResponse.json({ data: archived });
}
