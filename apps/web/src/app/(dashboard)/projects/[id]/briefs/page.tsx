import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { AnalysisJobStatus } from "../analysis-job-status";
import { BriefsPanel } from "../briefs-panel";
import { GenerateBriefsButton } from "../generate-briefs-button";
import type { SerializedAnalysisJob } from "../analysis-job-status";
import type { BriefItem } from "../briefs-panel";
import type { BriefStatus } from "@prisma/client";

const VALID_STATUSES = new Set(["PENDING", "ACCEPTED", "REJECTED", "DONE"]);

const STATUS_FILTER_LABELS: Record<string, string> = {
  "PENDING,ACCEPTED": "Attivi",
  PENDING: "Da fare",
  ACCEPTED: "Accettati",
  DONE: "Fatti",
  REJECTED: "Scartati",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function BriefsPage({ params, searchParams }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) notFound();

  const rawSearch = await searchParams;
  const activeStatus =
    typeof rawSearch.briefStatus === "string" ? rawSearch.briefStatus : "PENDING,ACCEPTED";

  const statuses = activeStatus
    .split(",")
    .map((s) => s.trim())
    .filter((s) => VALID_STATUSES.has(s)) as BriefStatus[];

  // ── Fetch data ───────────────────────────────────────────────────────────────

  const [rawBriefs, briefsTotal, activeBriefsJobRaw, latestBriefsJobRaw] = await Promise.all([
    prisma.contentBrief.findMany({
      where: {
        projectId: id,
        ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.contentBrief.count({
      where: {
        projectId: id,
        ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      },
    }),
    prisma.analysisJob.findFirst({
      where: { projectId: id, jobType: "GENERATE_BRIEFS", status: { in: ["PENDING", "RUNNING"] } },
      select: { id: true },
    }),
    prisma.analysisJob.findFirst({
      where: { projectId: id, jobType: "GENERATE_BRIEFS" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // ── Serialize ────────────────────────────────────────────────────────────────

  const briefs: BriefItem[] = rawBriefs.map((b) => ({
    ...b,
    keyPoints: b.keyPoints as string[],
    entities: b.entities as string[],
    generatedAt: b.generatedAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
  }));

  const hasActiveBriefsJob = activeBriefsJobRaw !== null;

  const latestBriefsJob: SerializedAnalysisJob | null = latestBriefsJobRaw
    ? {
        ...latestBriefsJobRaw,
        resultSummary: latestBriefsJobRaw.resultSummary as Record<string, unknown> | null,
        startedAt: latestBriefsJobRaw.startedAt?.toISOString() ?? null,
        completedAt: latestBriefsJobRaw.completedAt?.toISOString() ?? null,
        createdAt: latestBriefsJobRaw.createdAt.toISOString(),
      }
    : null;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Content Brief</h1>
          <p className="text-sm text-muted-foreground">
            Guide di scrittura generate automaticamente dai gap del tuo contenuto.
          </p>
        </div>
        <GenerateBriefsButton projectId={id} hasActiveBriefsJob={hasActiveBriefsJob} />
      </div>

      {/* ── Active job banner ── */}
      {latestBriefsJob && (
        <AnalysisJobStatus projectId={id} initialJob={latestBriefsJob} />
      )}

      {/* ── Status filters ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => (
          <a
            key={value}
            href={`/projects/${id}/briefs?briefStatus=${value}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeStatus === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* ── Briefs panel ── */}
      <BriefsPanel
        projectId={id}
        initialBriefs={briefs}
        initialTotal={briefsTotal}
        activeStatus={activeStatus}
      />
    </div>
  );
}
