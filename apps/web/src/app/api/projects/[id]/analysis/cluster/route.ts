import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { analysisQueue } from "@/lib/queue";

const MIN_ITEMS_FOR_CLUSTER = 6;

export async function POST(
  _req: NextRequest,
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

  // Count items with embeddings (raw query — Prisma omits vector field)
  const rows = await prisma.$queryRawUnsafe<{ count: string }[]>(
    `SELECT COUNT(*) as count
     FROM content_items
     WHERE project_id = $1
       AND embedding IS NOT NULL`,
    projectId
  );
  const eligible = Number(rows[0]?.count ?? 0);

  if (eligible < MIN_ITEMS_FOR_CLUSTER) {
    return NextResponse.json(
      {
        error: {
          message: `Need at least ${MIN_ITEMS_FOR_CLUSTER} items with embeddings for clustering (found ${eligible}).`,
          code: "INSUFFICIENT_EMBEDDINGS",
        },
      },
      { status: 400 }
    );
  }

  const job = await prisma.analysisJob.create({
    data: { projectId, jobType: "CLUSTER_TOPICS", status: "PENDING" },
  });

  await analysisQueue.add("cluster-topics", {
    jobType: "CLUSTER_TOPICS",
    projectId,
    userId: user.id,
    analysisJobId: job.id,
  });

  return NextResponse.json({ data: { jobId: job.id, eligible } }, { status: 202 });
}
