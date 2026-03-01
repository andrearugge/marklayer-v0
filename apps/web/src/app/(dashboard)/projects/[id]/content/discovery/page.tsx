import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { StartDiscoveryDialog } from "../../start-discovery-dialog";
import { DiscoveryJobStatus } from "../../discovery-job-status";
import { DiscoveryReview } from "../../discovery-review";
import { FetchContentButton } from "../../fetch-content-button";
import { DiscoveryScheduleCard } from "../../discovery-schedule-card";
import type { SerializedDiscoveryJob } from "../../discovery-job-status";
import type { DiscoveredItem } from "../../discovery-review";
import { History } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<string, string> = {
  CRAWL_SITE: "Crawl sito",
  SEARCH_PLATFORM: "Ricerca piattaforme",
  FULL_DISCOVERY: "Full Discovery",
};

const JOB_STATUS_CFG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "In attesa", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  RUNNING: { label: "In esecuzione", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  COMPLETED: { label: "Completato", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  FAILED: { label: "Fallito", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  CANCELLED: { label: "Annullato", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DiscoveryPage({ params }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) notFound();

  // ── Fetch data ───────────────────────────────────────────────────────────────

  const [latestRaw, historyRaw, discoveredRaw, discoveredTotal, unfetchedCount] =
    await Promise.all([
      prisma.discoveryJob.findFirst({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.discoveryJob.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.contentItem.findMany({
        where: { projectId: id, status: "DISCOVERED" },
        select: {
          id: true,
          title: true,
          url: true,
          sourcePlatform: true,
          contentType: true,
          excerpt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.contentItem.count({ where: { projectId: id, status: "DISCOVERED" } }),
      prisma.contentItem.count({
        where: {
          projectId: id,
          url: { not: null },
          rawContent: null,
          status: { not: "REJECTED" },
        },
      }),
    ]);

  // ── Serialize dates ──────────────────────────────────────────────────────────

  function serializeJob(
    j: (typeof historyRaw)[number] | null
  ): SerializedDiscoveryJob | null {
    if (!j) return null;
    return {
      ...j,
      config: j.config as Record<string, unknown> | null,
      resultSummary: j.resultSummary as Record<string, unknown> | null,
      startedAt: j.startedAt?.toISOString() ?? null,
      completedAt: j.completedAt?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
    };
  }

  const latestJob = serializeJob(latestRaw);
  const jobHistory = historyRaw.map((j) => serializeJob(j)!);
  const discoveredItems: DiscoveredItem[] = discoveredRaw.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));

  const hasActiveJob =
    latestJob !== null &&
    (latestJob.status === "PENDING" || latestJob.status === "RUNNING");

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Discovery</h1>
          <p className="text-sm text-muted-foreground">
            Trova automaticamente i contenuti esistenti tramite crawl e ricerca per piattaforma.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <FetchContentButton projectId={id} unfetchedCount={unfetchedCount} />
          <StartDiscoveryDialog
            projectId={id}
            projectDomain={project.domain}
            hasActiveJob={hasActiveJob}
          />
        </div>
      </div>

      {/* ── Recurring schedule ── */}
      <DiscoveryScheduleCard
        projectId={id}
        projectDomain={project.domain}
      />

      {/* ── Current job status ── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Stato corrente</h2>
        <DiscoveryJobStatus projectId={id} initialJob={latestJob} />
      </section>

      {/* ── Items to review ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-semibold">
            Da revisionare
            {discoveredTotal > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({discoveredTotal})
              </span>
            )}
          </h2>
        </div>
        <DiscoveryReview
          items={discoveredItems}
          projectId={id}
          totalDiscovered={discoveredTotal}
        />
      </section>

      {/* ── Job history ── */}
      {jobHistory.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <History className="h-4 w-4" />
            Storico job
          </h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Tipo</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">
                    Avviato
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">
                    Completato
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Trovati</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobHistory.map((job) => {
                  const cfg = JOB_STATUS_CFG[job.status] ?? JOB_STATUS_CFG["PENDING"];
                  const summary = job.resultSummary as Record<string, unknown> | null;
                  const found =
                    summary &&
                    ("crawledCount" in summary
                      ? (summary.crawledCount as number)
                      : "totalFound" in summary
                      ? (summary.totalFound as number)
                      : "totalCreated" in summary
                      ? (summary.totalCreated as number)
                      : null);

                  return (
                    <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {formatDate(job.startedAt ?? job.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {formatDate(job.completedAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {found !== null ? found : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
