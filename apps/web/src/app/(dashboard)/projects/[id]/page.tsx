import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditProjectDialog } from "./edit-project-dialog";
import { ArchiveProjectButton } from "./archive-project-button";
import { FetchContentButton } from "./fetch-content-button";
import { StartAnalysisButton } from "./start-analysis-button";
import {
  Globe,
  FileText,
  Download,
  Zap,
  BookOpen,
  PlusCircle,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";
import type { ContentStatus } from "@prisma/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<string, string> = {
  CRAWL_SITE: "Crawl sito",
  SEARCH_PLATFORM: "Ricerca piattaforme",
  FULL_DISCOVERY: "Full Discovery",
  FULL_ANALYSIS: "Full Analisi",
  EXTRACT_ENTITIES: "Estrazione entità",
  GENERATE_EMBEDDINGS: "Generazione embedding",
  CLUSTER_TOPICS: "Clustering topic",
  COMPUTE_SCORE: "Calcolo score",
  GENERATE_CONTENT_SUGGESTIONS: "Suggerimenti contenuto",
  GENERATE_BRIEFS: "Generazione brief",
};

const JOB_STATUS_CFG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "In attesa", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  RUNNING: { label: "In esecuzione", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  COMPLETED: { label: "Completato", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  FAILED: { label: "Fallito", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  CANCELLED: { label: "Annullato", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

function formatDate(iso: string | Date | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDashboardPage({ params }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) notFound();

  const isArchived = project.status === "ARCHIVED";

  // ── Stats ──────────────────────────────────────────────────────────────────

  const [totalCount, byStatus, byPlatform, projectScore, briefsCount, unfetchedCount, rawContentCount] =
    await Promise.all([
      prisma.contentItem.count({ where: { projectId: id } }),
      prisma.contentItem.groupBy({
        by: ["status"],
        where: { projectId: id },
        _count: { _all: true },
      }),
      prisma.contentItem.groupBy({
        by: ["sourcePlatform"],
        where: { projectId: id },
        _count: { _all: true },
      }),
      prisma.projectScore.findUnique({
        where: { projectId: id },
        select: { isStale: true, overallScore: true, computedAt: true },
      }),
      prisma.contentBrief.count({ where: { projectId: id } }),
      prisma.contentItem.count({
        where: { projectId: id, url: { not: null }, rawContent: null, status: { not: "REJECTED" } },
      }),
      prisma.contentItem.count({
        where: { projectId: id, rawContent: { not: null } },
      }),
    ]);

  const statusMap = Object.fromEntries(
    byStatus.map((r) => [r.status, r._count._all])
  ) as Partial<Record<ContentStatus, number>>;

  const approvedCount = statusMap["APPROVED"] ?? 0;
  const discoveredCount = statusMap["DISCOVERED"] ?? 0;
  const platformCount = byPlatform.length;
  const hasScore = projectScore !== null;

  // ── Recent activity ────────────────────────────────────────────────────────

  const [recentDiscovery, recentAnalysis] = await Promise.all([
    prisma.discoveryJob.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true, jobType: true, status: true,
        startedAt: true, completedAt: true, createdAt: true,
      },
    }),
    prisma.analysisJob.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true, jobType: true, status: true,
        startedAt: true, completedAt: true, createdAt: true,
      },
    }),
  ]);

  const recentJobs = [
    ...recentDiscovery.map((j) => ({ ...j, kind: "discovery" as const })),
    ...recentAnalysis.map((j) => ({ ...j, kind: "analysis" as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  // ── Flow steps ─────────────────────────────────────────────────────────────

  type StepStatus = "completed" | "active" | "disabled";

  const steps: {
    icon: React.ElementType;
    title: string;
    description: string;
    status: StepStatus;
    action: React.ReactNode;
  }[] = [
    {
      icon: PlusCircle,
      title: "Aggiungi contenuti",
      description: "Importa URL, incolla testo o avvia una discovery automatica per trovare i tuoi contenuti esistenti.",
      status: totalCount > 0 ? "completed" : "active",
      action: (
        <Button asChild size="sm">
          <Link href={`/projects/${id}/content`}>Vai ai contenuti</Link>
        </Button>
      ),
    },
    {
      icon: Download,
      title: "Scarica testo raw",
      description: "Scarica il testo completo dei contenuti aggiunti per abilitare l'analisi AI.",
      status: totalCount === 0 ? "disabled" : rawContentCount > 0 ? "completed" : "active",
      action: totalCount > 0 ? (
        <FetchContentButton projectId={id} unfetchedCount={unfetchedCount} />
      ) : (
        <Button size="sm" disabled>Scarica raw</Button>
      ),
    },
    {
      icon: Zap,
      title: "Avvia analisi AI",
      description: "Estrai entità, genera embedding e calcola il tuo AI Readiness Score. Poi consulta score, entità e gap di copertura.",
      status: rawContentCount === 0 ? "disabled" : hasScore ? "completed" : "active",
      action: hasScore ? (
        <Button asChild size="sm" variant="outline">
          <Link href={`/projects/${id}/analysis`}>Vai all&apos;analisi</Link>
        </Button>
      ) : (
        <StartAnalysisButton
          projectId={id}
          disabled={rawContentCount === 0}
        />
      ),
    },
    {
      icon: BookOpen,
      title: "Genera brief",
      description: "Trasforma i gap rilevati in brief strutturati pronti per la produzione di contenuti.",
      status: !hasScore ? "disabled" : briefsCount > 0 ? "completed" : "active",
      action: (
        <Button asChild size="sm" variant="outline" disabled={!hasScore}>
          <Link href={`/projects/${id}/briefs`}>Vai ai brief</Link>
        </Button>
      ),
    },
    {
      icon: FileText,
      title: "Crea nuovi contenuti",
      description: "Usa i brief generati come guida per produrre nuovi contenuti ottimizzati.",
      status: briefsCount === 0 ? "disabled" : "active",
      action: (
        <Button asChild size="sm" variant="outline">
          <Link href={`/projects/${id}/content`}>Vai ai contenuti</Link>
        </Button>
      ),
    },
  ];

  const stepStatusIcon = (s: StepStatus) => {
    if (s === "completed") return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />;
    if (s === "active") return <Circle className="h-5 w-5 text-primary shrink-0" />;
    return <AlertCircle className="h-5 w-5 text-muted-foreground/40 shrink-0" />;
  };

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{project.name}</h1>
            {isArchived && <Badge variant="secondary">Archiviato</Badge>}
          </div>
          {project.domain && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <a
                href={project.domain.startsWith("http") ? project.domain : `https://${project.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors hover:underline"
              >
                {project.domain}
              </a>
            </div>
          )}
          {project.description && (
            <p className="text-sm text-muted-foreground max-w-xl">{project.description}</p>
          )}
        </div>

        {!isArchived && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <EditProjectDialog project={project} />
            <ArchiveProjectButton projectId={project.id} projectName={project.name} />
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Contenuti totali" value={totalCount} />
        <StatCard label="Approvati" value={approvedCount} />
        <StatCard label="Da revisionare" value={discoveredCount} />
        <StatCard label="Piattaforme" value={platformCount} />
      </div>

      {/* ── Flow guide ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Come funziona</h2>
          <p className="text-sm text-muted-foreground">
            Segui questi passi per ottenere il massimo dall&apos;analisi AI del tuo progetto.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isDisabled = step.status === "disabled";
            return (
              <Card
                key={index}
                className={isDisabled ? "opacity-50" : ""}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground shrink-0">
                        {index + 1}
                      </span>
                      <Icon className={`h-4 w-4 shrink-0 ${isDisabled ? "text-muted-foreground" : "text-primary"}`} />
                    </div>
                    {stepStatusIcon(step.status)}
                  </div>
                  <CardTitle className="text-sm font-semibold mt-1">{step.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                  {!isArchived && <div>{step.action}</div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Recent activity ── */}
      {recentJobs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Attività recente</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Job</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentJobs.map((job) => {
                  const cfg = JOB_STATUS_CFG[job.status] ?? JOB_STATUS_CFG["PENDING"];
                  return (
                    <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {formatDate(job.startedAt ?? job.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Footer meta ── */}
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
