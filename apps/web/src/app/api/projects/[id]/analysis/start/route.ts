/**
 * POST /api/projects/:id/analysis/start
 *
 * Enqueues a COMPUTE_SCORE job. In Phase 3.6 this will be upgraded to
 * FULL_ANALYSIS (EXTRACT → EMBED → CLUSTER → SCORE pipeline).
 */
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

  const contentCount = await prisma.contentItem.count({ where: { projectId } });
  if (contentCount === 0) {
    return NextResponse.json(
      {
        error: {
          message: "Nessun contenuto trovato. Aggiungi contenuti prima di avviare l'analisi.",
          code: "NO_CONTENT",
        },
      },
      { status: 400 }
    );
  }

  const job = await prisma.analysisJob.create({
    data: { projectId, jobType: "COMPUTE_SCORE", status: "PENDING" },
  });

  await analysisQueue.add("compute-score", {
    jobType: "COMPUTE_SCORE",
    projectId,
    userId: user.id,
    analysisJobId: job.id,
  });

  return NextResponse.json({ data: { jobId: job.id } }, { status: 202 });
}
