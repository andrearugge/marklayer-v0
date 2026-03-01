/**
 * POST /api/projects/:id/briefs/generate — enqueue GENERATE_BRIEFS job (202)
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";
import { analysisQueue } from "@/lib/queue";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
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

  // Check for active GENERATE_BRIEFS job
  const activeJob = await prisma.analysisJob.findFirst({
    where: {
      projectId,
      jobType: "GENERATE_BRIEFS",
      status: { in: ["PENDING", "RUNNING"] },
    },
  });
  if (activeJob) {
    return NextResponse.json(
      { error: { message: "Un job di generazione brief è già in corso.", code: "JOB_ACTIVE" } },
      { status: 409 }
    );
  }

  const analysisJob = await prisma.analysisJob.create({
    data: { projectId, jobType: "GENERATE_BRIEFS" },
  });

  await analysisQueue.add("GENERATE_BRIEFS", {
    jobType: "GENERATE_BRIEFS",
    projectId,
    userId: user.id,
    analysisJobId: analysisJob.id,
  });

  await logAuditEvent({
    action: AUDIT_ACTIONS.ANALYSIS_JOB_STARTED,
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    targetId: projectId,
    metadata: { jobType: "GENERATE_BRIEFS", analysisJobId: analysisJob.id },
  });

  return NextResponse.json({ data: { analysisJobId: analysisJob.id } }, { status: 202 });
}
