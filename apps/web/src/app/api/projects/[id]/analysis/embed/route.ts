import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { analysisQueue } from "@/lib/queue";

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

  // Count items with rawContent but no embedding (raw query — Prisma omits vector field)
  const rows = await prisma.$queryRawUnsafe<{ count: string }[]>(
    `SELECT COUNT(*) as count
     FROM content_items
     WHERE project_id = $1
       AND raw_content IS NOT NULL
       AND embedding IS NULL`,
    projectId
  );
  const eligible = Number(rows[0]?.count ?? 0);

  if (eligible === 0) {
    return NextResponse.json(
      {
        error: {
          message:
            "All items with extracted text already have embeddings, or no extracted text found.",
          code: "NO_ELIGIBLE_CONTENT",
        },
      },
      { status: 400 }
    );
  }

  const job = await prisma.analysisJob.create({
    data: { projectId, jobType: "GENERATE_EMBEDDINGS", status: "PENDING" },
  });

  await analysisQueue.add("generate-embeddings", {
    jobType: "GENERATE_EMBEDDINGS",
    projectId,
    userId: user.id,
    analysisJobId: job.id,
  });

  return NextResponse.json({ data: { jobId: job.id, eligible } }, { status: 202 });
}
