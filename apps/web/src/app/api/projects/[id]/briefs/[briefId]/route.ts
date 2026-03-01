/**
 * PATCH /api/projects/:id/briefs/:briefId  — update status
 * DELETE /api/projects/:id/briefs/:briefId — hard delete
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";

type RouteParams = { params: Promise<{ id: string; briefId: string }> };

const PatchSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "DONE"]),
});

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id: projectId, briefId } = await params;
  const project = await assertProjectOwnership(projectId, user.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid status", code: "VALIDATION_ERROR" } },
      { status: 400 }
    );
  }

  const brief = await prisma.contentBrief.findFirst({
    where: { id: briefId, projectId },
  });
  if (!brief) {
    return NextResponse.json(
      { error: { message: "Brief not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const updated = await prisma.contentBrief.update({
    where: { id: briefId },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id: projectId, briefId } = await params;
  const project = await assertProjectOwnership(projectId, user.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const brief = await prisma.contentBrief.findFirst({
    where: { id: briefId, projectId },
  });
  if (!brief) {
    return NextResponse.json(
      { error: { message: "Brief not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  await prisma.contentBrief.delete({ where: { id: briefId } });

  return NextResponse.json({ data: { deleted: true } });
}
