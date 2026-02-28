import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";

export async function GET(
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

  const topics = await prisma.entity.findMany({
    where: { projectId, type: "TOPIC" },
    orderBy: { frequency: "desc" },
    select: {
      id: true,
      label: true,
      frequency: true,
      contentEntities: {
        select: {
          content: {
            select: { id: true, title: true },
          },
        },
        take: 3,
        orderBy: { salience: "desc" },
      },
    },
  });

  return NextResponse.json({ data: topics });
}
