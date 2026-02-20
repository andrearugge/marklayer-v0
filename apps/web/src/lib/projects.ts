import { prisma } from "@/lib/prisma";
import type { Project } from "@prisma/client";

/**
 * Fetches a project and verifies it belongs to the given user.
 * Returns null if the project does not exist or is not owned by the user.
 * Callers should return 404 in both cases to avoid leaking existence.
 */
export async function assertProjectOwnership(
  projectId: string,
  userId: string
): Promise<Project | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project || project.userId !== userId) return null;

  return project;
}
