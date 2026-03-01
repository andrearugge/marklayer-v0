import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectNavProvider } from "@/components/dashboard/project-nav-context";

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: currentUser.id },
    select: { id: true, name: true, status: true },
  });

  if (!project) notFound();

  return (
    <ProjectNavProvider projectId={project.id} projectName={project.name}>
      {children}
    </ProjectNavProvider>
  );
}
