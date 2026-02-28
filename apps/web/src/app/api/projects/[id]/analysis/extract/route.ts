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

  // Check there are APPROVED items with rawContent to process
  const eligible = await prisma.contentItem.count({
    where: { projectId, status: "APPROVED", rawContent: { not: null } },
  });

  if (eligible === 0) {
    return NextResponse.json(
      {
        error: {
          message:
            "No approved content with extracted text found. Approve content and fetch raw text first.",
          code: "NO_ELIGIBLE_CONTENT",
        },
      },
      { status: 400 }
    );
  }

  const job = await prisma.analysisJob.create({
    data: { projectId, jobType: "EXTRACT_ENTITIES", status: "PENDING" },
  });

  await analysisQueue.add("extract-entities", {
    jobType: "EXTRACT_ENTITIES",
    projectId,
    userId: user.id,
    analysisJobId: job.id,
  });

  return NextResponse.json({ data: { jobId: job.id, eligible } }, { status: 202 });
}
