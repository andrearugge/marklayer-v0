import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { ProjectSettingsForm } from "./project-settings-form";
import { RestoreProjectButton } from "./restore-project-button";
import { ArchiveProjectButton } from "../archive-project-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectSettingsPage({ params }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) notFound();

  const isArchived = project.status === "ARCHIVED";

  return (
    <div className="space-y-8 max-w-2xl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Impostazioni progetto</h1>
        {isArchived && <Badge variant="secondary">Archiviato</Badge>}
      </div>

      {/* ── General settings ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informazioni generali</CardTitle>
          <CardDescription>
            Nome, dominio e descrizione del progetto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectSettingsForm project={project} />
        </CardContent>
      </Card>

      {/* ── Danger zone ── */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Zona pericolo</CardTitle>
          <CardDescription>
            {isArchived
              ? "Il progetto è archiviato. Puoi ripristinarlo per renderlo nuovamente attivo."
              : "L'archiviazione nasconde il progetto dalla lista. I dati non vengono eliminati."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isArchived ? (
            <RestoreProjectButton projectId={project.id} projectName={project.name} />
          ) : (
            <ArchiveProjectButton projectId={project.id} projectName={project.name} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
