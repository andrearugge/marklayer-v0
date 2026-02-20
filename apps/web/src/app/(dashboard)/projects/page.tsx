import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateProjectDialog } from "./create-project-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Globe, FileText, ChevronRight } from "lucide-react";
import type { ProjectStatus } from "@prisma/client";

type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  domain: string | null;
  status: ProjectStatus;
  createdAt: Date;
  _count: { contentItems: number };
};

function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight group-hover:text-primary transition-colors">
              {project.name}
            </CardTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              {project.status === "ARCHIVED" && (
                <Badge variant="secondary">Archiviato</Badge>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
          {project.domain && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              {project.domain}
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {project.description && (
            <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              <span>
                {project._count.contentItems} contenut
                {project._count.contentItems === 1 ? "o" : "i"}
              </span>
            </div>
            <span>
              {new Date(project.createdAt).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
      <h3 className="mb-1 text-lg font-semibold">Nessun progetto</h3>
      <p className="mb-6 text-sm text-muted-foreground">
        Crea il tuo primo progetto per iniziare a tracciare i contenuti.
      </p>
      <CreateProjectDialog />
    </div>
  );
}

export default async function ProjectsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

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
      _count: { select: { contentItems: true } },
    },
  });

  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const archivedProjects = projects.filter((p) => p.status === "ARCHIVED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            {activeProjects.length} progett
            {activeProjects.length === 1 ? "o attivo" : "i attivi"}
          </p>
        </div>
        {projects.length > 0 && <CreateProjectDialog />}
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>

          {archivedProjects.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Archiviati ({archivedProjects.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archivedProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
