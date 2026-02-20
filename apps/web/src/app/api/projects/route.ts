import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateProjectSchema } from "@/lib/validations/project";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const projects = await prisma.project.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      domain: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { contentItems: true } },
    },
  });

  return NextResponse.json({ data: projects });
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const body = await req.json();
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: "Dati non validi",
          code: "INVALID_DATA",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { name, description, domain } = parsed.data;

  const project = await prisma.project.create({
    data: {
      userId: currentUser.id,
      name,
      description: description || null,
      domain: domain || null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      domain: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { contentItems: true } },
    },
  });

  await logAuditEvent({
    action: AUDIT_ACTIONS.PROJECT_CREATED,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: project.id,
    metadata: { projectName: project.name },
  });

  return NextResponse.json({ data: project }, { status: 201 });
}
