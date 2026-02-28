import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { BulkActionSchema } from "@/lib/validations/content";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

const STATUS_MAP = {
  approve: "APPROVED",
  reject: "REJECTED",
  archive: "ARCHIVED",
} as const;

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
          message: "Dati non validi",
          code: "INVALID_DATA",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { ids, action } = parsed.data;

  // Verify all requested IDs actually belong to this project
  const ownedCount = await prisma.contentItem.count({
    where: { id: { in: ids }, projectId },
  });
  if (ownedCount !== ids.length) {
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

  let count = 0;

  if (action === "delete") {
    const result = await prisma.contentItem.deleteMany({
      where: { id: { in: ids }, projectId },
    });
    count = result.count;
  } else {
    const result = await prisma.contentItem.updateMany({
      where: { id: { in: ids }, projectId },
      data: { status: STATUS_MAP[action] },
    });
    count = result.count;
  }

  await logAuditEvent({
    action: AUDIT_ACTIONS.CONTENT_BULK_ACTION,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: projectId,
    metadata: { action, count, ids },
  });

  // Mark score as stale — content changed
  await prisma.projectScore.updateMany({
    where: { projectId },
    data: { isStale: true },
  });

  return NextResponse.json({ data: { count, action } });
}
