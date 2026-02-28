import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { z } from "zod/v4";

const QuerySchema = z.object({
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id: projectId } = await params;
  const project = await assertProjectOwnership(projectId, user.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const q = QuerySchema.parse({
    type: sp.get("type") ?? undefined,
    page: sp.get("page") ?? 1,
    limit: sp.get("limit") ?? 20,
  });

  const where = {
    projectId,
    ...(q.type && q.type !== "ALL" ? { type: q.type as never } : {}),
    // Exclude TOPIC entities (shown in topics panel)
    NOT: { type: "TOPIC" as never },
  };

  const [entities, total] = await Promise.all([
    prisma.entity.findMany({
      where,
      orderBy: { frequency: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: { id: true, label: true, type: true, frequency: true },
    }),
    prisma.entity.count({ where }),
  ]);

  return NextResponse.json({
    data: entities,
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
    },
  });
}
