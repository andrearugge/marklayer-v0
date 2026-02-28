/**
 * POST /api/projects/:id/analysis/suggestions
 *
 * Enqueues a GENERATE_CONTENT_SUGGESTIONS batch job.
 * Processes up to 50 APPROVED items with rawContent that have no recent suggestion.
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

  // Count eligible items (APPROVED + rawContent)
  const eligible = await prisma.contentItem.count({
    where: {
      projectId,
      status: "APPROVED",
      rawContent: { not: null },
    },
  });

  if (eligible === 0) {
    return NextResponse.json(
      {
        error: {
          message: "Nessun contenuto approvato con testo estratto trovato.",
          code: "NO_ELIGIBLE_CONTENT",
        },
      },
      { status: 400 }
    );
  }

  const job = await prisma.analysisJob.create({
    data: {
      projectId,
      jobType: "GENERATE_CONTENT_SUGGESTIONS",
      status: "PENDING",
    },
  });

  await analysisQueue.add("generate-content-suggestions", {
    jobType: "GENERATE_CONTENT_SUGGESTIONS",
    projectId,
    userId: user.id,
    analysisJobId: job.id,
  });

  return NextResponse.json({ data: { jobId: job.id, eligible } }, { status: 202 });
}
