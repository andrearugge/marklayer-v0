import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { PLATFORM_LABELS } from "@/lib/content-labels";
import { AnalysisJobStatus } from "../analysis-job-status";
import { StartAnalysisButton } from "../start-analysis-button";
import { ScoreCard } from "../score-card";
import { EntitiesPanel } from "../entities-panel";
import { TopicsPanel } from "../topics-panel";
import { ContentHealthCard } from "../content-health-card";
import { GapAnalysisCard } from "../gap-analysis-card";
import { GenerateSuggestionsButton } from "../generate-suggestions-button";
import type { SerializedAnalysisJob } from "../analysis-job-status";
import type { SerializedProjectScore } from "../score-card";
import type { EntityItem } from "../entities-panel";
import type { TopicItem } from "../topics-panel";
import type { ContentHealth } from "../content-health-card";
import type { GapAnalysisData } from "../gap-analysis-card";
import type { SourcePlatform } from "@prisma/client";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AnalysisPage({ params, searchParams }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) notFound();

  const rawSearch = await searchParams;
  const entityPage = Math.max(1, Number(rawSearch.entityPage) || 1);
  const entityType = typeof rawSearch.entityType === "string" ? rawSearch.entityType : "ALL";
  const entityLimit = 20;

  // ── Fetch data ───────────────────────────────────────────────────────────────

  const entityWhere = {
    projectId: id,
    ...(entityType && entityType !== "ALL" ? { type: entityType as never } : {}),
    NOT: { type: "TOPIC" as never },
  };

  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const [
    totalCount,
    byPlatform,
    rawScore,
    rawLatestJob,
    rawEntities,
    rawEntityTotal,
    rawTopics,
    rawHealthStats,
    rawWordCount,
    withRawCount,
    freshCount,
    agingCount,
    staleCount,
    totalWithDateCount,
    approvedCount,
  ] = await Promise.all([
    prisma.contentItem.count({ where: { projectId: id } }),
    prisma.contentItem.groupBy({
      by: ["sourcePlatform"],
      where: { projectId: id },
      _count: { _all: true },
      orderBy: { _count: { sourcePlatform: "desc" } },
    }),
    prisma.projectScore.findUnique({ where: { projectId: id } }),
    prisma.analysisJob.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.entity.findMany({
      where: entityWhere,
      orderBy: { frequency: "desc" },
      skip: (entityPage - 1) * entityLimit,
      take: entityLimit,
      select: { id: true, label: true, type: true, frequency: true },
    }),
    prisma.entity.count({ where: entityWhere }),
    prisma.entity.findMany({
      where: { projectId: id, type: "TOPIC" },
      orderBy: { frequency: "desc" },
      select: {
        id: true,
        label: true,
        frequency: true,
        contentEntities: {
          select: { content: { select: { id: true, title: true } } },
          take: 3,
          orderBy: { salience: "desc" },
        },
      },
    }),
    prisma.contentItem.groupBy({
      by: ["status"],
      where: { projectId: id },
      _count: { _all: true },
    }),
    prisma.contentItem.aggregate({
      where: { projectId: id, wordCount: { not: null } },
      _avg: { wordCount: true },
    }),
    prisma.contentItem.count({ where: { projectId: id, rawContent: { not: null } } }),
    prisma.contentItem.count({ where: { projectId: id, publishedAt: { gte: sixMonthsAgo } } }),
    prisma.contentItem.count({
      where: { projectId: id, publishedAt: { gte: twelveMonthsAgo, lt: sixMonthsAgo } },
    }),
    prisma.contentItem.count({ where: { projectId: id, publishedAt: { lt: twelveMonthsAgo } } }),
    prisma.contentItem.count({ where: { projectId: id, publishedAt: { not: null } } }),
    prisma.contentItem.count({ where: { projectId: id, status: "APPROVED" } }),
  ]);

  // ── Serialize ────────────────────────────────────────────────────────────────

  const projectScore: SerializedProjectScore | null = rawScore
    ? {
        id: rawScore.id,
        overallScore: rawScore.overallScore,
        dimensions: rawScore.dimensions as unknown as SerializedProjectScore["dimensions"],
        suggestions: rawScore.suggestions as string[] | null,
        contentCount: rawScore.contentCount,
        isStale: rawScore.isStale,
        computedAt: rawScore.computedAt.toISOString(),
      }
    : null;

  const latestJob: SerializedAnalysisJob | null = rawLatestJob
    ? {
        ...rawLatestJob,
        resultSummary: rawLatestJob.resultSummary as Record<string, unknown> | null,
        startedAt: rawLatestJob.startedAt?.toISOString() ?? null,
        completedAt: rawLatestJob.completedAt?.toISOString() ?? null,
        createdAt: rawLatestJob.createdAt.toISOString(),
      }
    : null;

  const entities: EntityItem[] = rawEntities.map((e) => ({ ...e, type: e.type as string }));
  const entityTotalPages = Math.ceil(rawEntityTotal / entityLimit);
  const topics = rawTopics as TopicItem[];

  const statusHealthMap = Object.fromEntries(
    rawHealthStats.map((r) => [r.status, r._count._all])
  ) as Record<string, number>;

  const contentHealth: ContentHealth = {
    total: totalCount,
    withRawContent: withRawCount,
    avgWordCount: rawWordCount._avg.wordCount ?? null,
    approved: approvedCount,
    discovered: statusHealthMap["DISCOVERED"] ?? 0,
    rejected: statusHealthMap["REJECTED"] ?? 0,
    archived: statusHealthMap["ARCHIVED"] ?? 0,
  };

  // ── Gap analysis ─────────────────────────────────────────────────────────────

  const allPlatforms = Object.keys(PLATFORM_LABELS) as SourcePlatform[];
  const platformsWithContent = new Set(byPlatform.map((r) => r.sourcePlatform));
  const missingPlatforms = allPlatforms
    .filter((p) => p !== "OTHER" && !platformsWithContent.has(p))
    .map((p) => ({ platform: p, label: PLATFORM_LABELS[p] }));
  const weakPlatforms = byPlatform
    .filter((r) => r.sourcePlatform !== "OTHER" && r._count._all <= 2)
    .map((r) => ({ platform: r.sourcePlatform, label: PLATFORM_LABELS[r.sourcePlatform], count: r._count._all }));
  const thinTopics = rawTopics
    .filter((t) => t.frequency < 3)
    .map((t) => ({ label: t.label, count: t.frequency }));
  const lowCoverageEntities =
    approvedCount >= 5
      ? rawEntities
          .filter(
            (e) =>
              ["BRAND", "PERSON", "ORGANIZATION", "PRODUCT"].includes(e.type) &&
              e.frequency / approvedCount < 0.25
          )
          .slice(0, 3)
          .map((e) => ({ label: e.label, type: e.type, frequency: e.frequency }))
      : [];

  const gapData: GapAnalysisData = {
    missingPlatforms,
    weakPlatforms,
    lowCoverageEntities,
    thinTopics,
    freshContent: freshCount,
    agingContent: agingCount,
    staleContent: staleCount,
    totalWithDate: totalWithDateCount,
    approvedCount,
  };

  const isJobActive =
    latestJob !== null &&
    (latestJob.status === "PENDING" || latestJob.status === "RUNNING");

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Analisi AI</h1>
          <p className="text-sm text-muted-foreground">
            Score di visibilità, entità estratte e gap nella copertura dei contenuti.
          </p>
        </div>
        <StartAnalysisButton
          projectId={id}
          disabled={approvedCount === 0 || isJobActive}
        />
      </div>

      {/* ── Active job banner ── */}
      {latestJob && <AnalysisJobStatus projectId={id} initialJob={latestJob} />}

      {/* ── Score + Health ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ScoreCard projectId={id} score={projectScore} hasContent={totalCount > 0} />
        <ContentHealthCard health={contentHealth} />
      </div>

      {/* ── Gap analysis ── */}
      <GapAnalysisCard data={gapData} />

      {/* ── Batch suggestions ── */}
      {totalCount > 0 && (
        <div className="flex justify-end">
          <GenerateSuggestionsButton projectId={id} />
        </div>
      )}

      {/* ── Entities ── */}
      <EntitiesPanel
        projectId={id}
        entities={entities}
        activeType={entityType}
        page={entityPage}
        totalPages={entityTotalPages}
        total={rawEntityTotal}
      />

      {/* ── Topics ── */}
      <TopicsPanel topics={topics} />
    </div>
  );
}
