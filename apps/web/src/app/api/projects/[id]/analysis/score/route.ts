import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { analysisQueue } from "@/lib/queue";

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET — return current ProjectScore ───────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
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

  const score = await prisma.projectScore.findUnique({
    where: { projectId },
  });

  return NextResponse.json({ data: score ?? null });
}

// ─── POST — enqueue COMPUTE_SCORE job ────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: RouteParams
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

  // Check there is at least 1 content item to score
  const contentCount = await prisma.contentItem.count({ where: { projectId } });
  if (contentCount === 0) {
    return NextResponse.json(
      {
        error: {
          message: "No content items found. Add content before computing the score.",
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

  return NextResponse.json({ data: { jobId: job.id, contentCount } }, { status: 202 });
}
