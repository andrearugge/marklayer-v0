import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { EditProjectDialog } from "./edit-project-dialog";
import { ArchiveProjectButton } from "./archive-project-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Globe,
  FileText,
  ArrowLeft,
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  Archive,
} from "lucide-react";
import type { SourcePlatform, ContentType, ContentStatus } from "@prisma/client";

const PLATFORM_LABELS: Record<SourcePlatform, string> = {
  WEBSITE: "Website",
  SUBSTACK: "Substack",
  MEDIUM: "Medium",
  LINKEDIN: "LinkedIn",
  REDDIT: "Reddit",
  QUORA: "Quora",
  YOUTUBE: "YouTube",
  TWITTER: "Twitter / X",
  NEWS: "News",
  OTHER: "Altro",
};

const TYPE_LABELS: Record<ContentType, string> = {
  ARTICLE: "Articolo",
  BLOG_POST: "Blog Post",
  PAGE: "Pagina",
  SOCIAL_POST: "Post Social",
  COMMENT: "Commento",
  MENTION: "Menzione",
  VIDEO: "Video",
  PODCAST: "Podcast",
  OTHER: "Altro",
};

const STATUS_LABELS: Record<ContentStatus, string> = {
  DISCOVERED: "Trovato",
  APPROVED: "Approvato",
  REJECTED: "Rifiutato",
  ARCHIVED: "Archiviato",
};

const STATUS_COLORS: Record<ContentStatus, string> = {
  DISCOVERED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ARCHIVED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

type PageProps = { params: Promise<{ id: string }> };

export default async function ProjectDetailPage({ params }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) notFound();

  const [totalCount, byPlatform, byType, byStatus] = await Promise.all([
    prisma.contentItem.count({ where: { projectId: id } }),
    prisma.contentItem.groupBy({
      by: ["sourcePlatform"],
      where: { projectId: id },
      _count: { _all: true },
      orderBy: { _count: { sourcePlatform: "desc" } },
    }),
    prisma.contentItem.groupBy({
      by: ["contentType"],
      where: { projectId: id },
      _count: { _all: true },
      orderBy: { _count: { contentType: "desc" } },
    }),
    prisma.contentItem.groupBy({
      by: ["status"],
      where: { projectId: id },
      _count: { _all: true },
    }),
  ]);

  const statusMap = Object.fromEntries(
    byStatus.map((r) => [r.status, r._count._all])
  ) as Partial<Record<ContentStatus, number>>;

  const isArchived = project.status === "ARCHIVED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tutti i progetti
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {project.name}
              </h1>
              {isArchived && <Badge variant="secondary">Archiviato</Badge>}
            </div>
            {project.domain && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <a
                  href={
                    project.domain.startsWith("http")
                      ? project.domain
                      : `https://${project.domain}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors hover:underline"
                >
                  {project.domain}
                </a>
              </div>
            )}
            {project.description && (
              <p className="text-sm text-muted-foreground max-w-xl">
                {project.description}
              </p>
            )}
          </div>

          {!isArchived && (
            <div className="flex items-center gap-2 shrink-0">
              <EditProjectDialog project={project} />
              <ArchiveProjectButton
                projectId={project.id}
                projectName={project.name}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Contenuti totali" value={totalCount} />
        <StatCard
          label="Approvati"
          value={statusMap["APPROVED"] ?? 0}
        />
        <StatCard
          label="Da revisionare"
          value={statusMap["DISCOVERED"] ?? 0}
        />
        <StatCard
          label="Piattaforme"
          value={byPlatform.length}
        />
      </div>

      {/* Content breakdown */}
      {totalCount > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {/* By platform */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Per piattaforma</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {byPlatform.map((r) => (
                <div key={r.sourcePlatform} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {PLATFORM_LABELS[r.sourcePlatform]}
                  </span>
                  <span className="font-medium">{r._count._all}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* By type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Per tipo</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {byType.map((r) => (
                <div key={r.contentType} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {TYPE_LABELS[r.contentType]}
                  </span>
                  <span className="font-medium">{r._count._all}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* By status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Per status</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {byStatus.map((r) => (
                <div key={r.status} className="flex items-center justify-between text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}
                  >
                    {STATUS_LABELS[r.status]}
                  </span>
                  <span className="font-medium">{r._count._all}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="mb-1 text-lg font-semibold">Nessun contenuto</h3>
          <p className="text-sm text-muted-foreground">
            Aggiungi contenuti per iniziare a tracciare la tua visibilità online.
          </p>
        </div>
      )}

      {/* Project meta */}
      <div className="text-xs text-muted-foreground border-t pt-4">
        Creato il{" "}
        {new Date(project.createdAt).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
        {" · "}
        Ultimo aggiornamento{" "}
        {new Date(project.updatedAt).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </div>
    </div>
  );
}
