import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  TrendingUp,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/content-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ContentStatus } from "@prisma/client";

// ─── Label maps ────────────────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<string, string> = {
  EXTRACT_ENTITIES:    "Estrazione entità",
  GENERATE_EMBEDDINGS: "Generazione embedding",
  CLUSTER_TOPICS:      "Clustering topic",
  COMPUTE_SCORE:       "Calcolo score",
  FULL_ANALYSIS:       "Analisi completa",
};

const STATUS_ORDER: ContentStatus[] = [
  "DISCOVERED",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground/40 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null)
    return <span className="text-sm text-muted-foreground">—</span>;

  const rounded = Math.round(score);
  const color =
    rounded < 40
      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      : rounded < 70
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${color}`}
    >
      {rounded}
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userId = user.id;

  const [activeProjectCount, contentCounts, projectsWithScores, recentJobs] =
    await Promise.all([
      // KPI 1: active projects
      prisma.project.count({ where: { userId, status: "ACTIVE" } }),

      // KPI 2+3 + status breakdown: content grouped by status
      prisma.contentItem.groupBy({
        by: ["status"],
        where: { project: { userId } },
        _count: { _all: true },
      }),

      // Projects table: name, domain, content count, score
      prisma.project.findMany({
        where: { userId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          domain: true,
          _count: { select: { contentItems: true } },
          score: {
            select: { overallScore: true, isStale: true, computedAt: true },
          },
        },
      }),

      // Recent activity: last 5 completed analysis jobs
      prisma.analysisJob.findMany({
        where: { status: "COMPLETED", project: { userId } },
        orderBy: { completedAt: "desc" },
        take: 5,
        select: {
          id: true,
          jobType: true,
          completedAt: true,
          project: { select: { id: true, name: true } },
        },
      }),
    ]);

  // ── Derived values ──────────────────────────────────────────────────────────

  const statusMap = Object.fromEntries(
    contentCounts.map((r) => [r.status, r._count._all])
  ) as Partial<Record<ContentStatus, number>>;

  const totalContent = Object.values(statusMap).reduce(
    (sum, n) => sum + (n ?? 0),
    0
  );
  const approvedContent = statusMap["APPROVED"] ?? 0;

  const scoredProjects = projectsWithScores.filter((p) => p.score !== null);
  const avgScore =
    scoredProjects.length > 0
      ? Math.round(
          scoredProjects.reduce((sum, p) => sum + p.score!.overallScore, 0) /
            scoredProjects.length
        )
      : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Panoramica di tutti i tuoi progetti e contenuti.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard
          label="Progetti attivi"
          value={activeProjectCount}
          icon={FolderOpen}
        />
        <KpiCard
          label="Contenuti totali"
          value={totalContent}
          icon={FileText}
        />
        <KpiCard
          label="Contenuti approvati"
          value={approvedContent}
          icon={CheckCircle2}
          sub={totalContent > 0 ? `${Math.round((approvedContent / totalContent) * 100)}% del totale` : undefined}
        />
        <KpiCard
          label="Score AI medio"
          value={avgScore ?? "—"}
          icon={TrendingUp}
          sub={
            scoredProjects.length > 0
              ? `su ${scoredProjects.length} progett${scoredProjects.length === 1 ? "o" : "i"} analizzat${scoredProjects.length === 1 ? "o" : "i"}`
              : "Nessuna analisi eseguita"
          }
        />
      </div>

      {/* Main grid: projects table + sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Projects overview — takes 2/3 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="h-4 w-4" />
                Progetti
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {projectsWithScores.length === 0 ? (
                <div className="py-8 text-center">
                  <FolderOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    Nessun progetto attivo.{" "}
                    <Link href="/projects" className="underline underline-offset-4 hover:text-foreground">
                      Crea il primo progetto →
                    </Link>
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Progetto</TableHead>
                      <TableHead className="text-right">Contenuti</TableHead>
                      <TableHead className="text-right">Score AI</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">Ultima analisi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectsWithScores.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <Link
                              href={`/projects/${p.id}`}
                              className="font-medium hover:underline underline-offset-4"
                            >
                              {p.name}
                            </Link>
                            {p.domain && (
                              <p className="text-xs text-muted-foreground">
                                {p.domain}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p._count.contentItems}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.score?.isStale && (
                              <Badge
                                variant="outline"
                                className="text-yellow-600 border-yellow-300 text-xs py-0 h-5"
                              >
                                Stale
                              </Badge>
                            )}
                            <Link href={`/projects/${p.id}?tab=analysis`}>
                              <ScoreBadge score={p.score?.overallScore ?? null} />
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right text-sm text-muted-foreground">
                          {p.score?.computedAt
                            ? p.score.computedAt.toLocaleString("it-IT", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: status breakdown + recent activity */}
        <div className="space-y-6">
          {/* Content status breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Contenuti per status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {totalContent === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nessun contenuto ancora.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Visual bar */}
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    {STATUS_ORDER.map((s) => {
                      const count = statusMap[s] ?? 0;
                      const pct = (count / totalContent) * 100;
                      if (pct === 0) return null;
                      const barColor =
                        s === "APPROVED"
                          ? "bg-green-500"
                          : s === "DISCOVERED"
                          ? "bg-yellow-400"
                          : s === "REJECTED"
                          ? "bg-red-400"
                          : "bg-gray-300";
                      return (
                        <div
                          key={s}
                          className={barColor}
                          style={{ width: `${pct}%` }}
                        />
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="space-y-1.5">
                    {STATUS_ORDER.map((s) => {
                      const count = statusMap[s] ?? 0;
                      return (
                        <div
                          key={s}
                          className="flex items-center justify-between text-sm"
                        >
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[s]}`}
                          >
                            {STATUS_LABELS[s]}
                          </span>
                          <span className="font-medium tabular-nums">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Analisi recenti
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {recentJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nessuna analisi eseguita ancora.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <Link
                          href={`/projects/${job.project.id}?tab=analysis`}
                          className="hover:underline underline-offset-4 truncate max-w-[140px]"
                        >
                          {job.project.name}
                        </Link>
                        <span className="shrink-0 tabular-nums">
                          {job.completedAt?.toLocaleString("it-IT", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }) ?? "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
