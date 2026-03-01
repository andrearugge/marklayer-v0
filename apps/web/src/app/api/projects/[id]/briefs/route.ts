/**
 * GET /api/projects/:id/briefs?status=PENDING,ACCEPTED&page=1
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import type { BriefStatus } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUSES = new Set<string>(["PENDING", "ACCEPTED", "REJECTED", "DONE"]);
const LIMIT = 20;

export async function GET(req: NextRequest, { params }: RouteParams) {
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

  const url = req.nextUrl;
  const statusParam = url.searchParams.get("status") ?? "PENDING,ACCEPTED";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

  const statuses = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => VALID_STATUSES.has(s)) as BriefStatus[];

  const where = {
    projectId,
    ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
  };

  const [briefs, total] = await Promise.all([
    prisma.contentBrief.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.contentBrief.count({ where }),
  ]);

  return NextResponse.json({
    data: briefs,
    pagination: {
      page,
      limit: LIMIT,
      total,
      totalPages: Math.ceil(total / LIMIT),
    },
  });
}
