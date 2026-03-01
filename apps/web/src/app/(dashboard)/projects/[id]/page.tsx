import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { ContentQuerySchema } from "@/lib/validations/content";
import {
  PLATFORM_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/content-labels";
import { EditProjectDialog } from "./edit-project-dialog";
import { ArchiveProjectButton } from "./archive-project-button";
import { AddContentDialog } from "./add-content-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { ContentFilters } from "./content-filters";
import { ContentPagination } from "./content-pagination";
import { ContentTable } from "./content-table";
import { StartDiscoveryDialog } from "./start-discovery-dialog";
import { DiscoveryJobStatus } from "./discovery-job-status";
import { DiscoveryReview } from "./discovery-review";
import { FetchContentButton } from "./fetch-content-button";
import { AnalysisJobStatus } from "./analysis-job-status";
import { ScoreCard } from "./score-card";
import { EntitiesPanel } from "./entities-panel";
import { TopicsPanel } from "./topics-panel";
import { ContentHealthCard } from "./content-health-card";
import { GapAnalysisCard } from "./gap-analysis-card";
import type { GapAnalysisData } from "./gap-analysis-card";
import { GenerateSuggestionsButton } from "./generate-suggestions-button";
import { SemanticSearchPanel } from "./semantic-search-panel";
import { BriefsPanel } from "./briefs-panel";
import type { BriefItem } from "./briefs-panel";
import { GenerateBriefsButton } from "./generate-briefs-button";
import type { SerializedDiscoveryJob } from "./discovery-job-status";
import type { DiscoveredItem } from "./discovery-review";
import type { SerializedAnalysisJob } from "./analysis-job-status";
import type { SerializedProjectScore } from "./score-card";
import type { EntityItem } from "./entities-panel";
import type { TopicItem } from "./topics-panel";
import type { ContentHealth } from "./content-health-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, FileText, ArrowLeft, History } from "lucide-react";
import type { SourcePlatform, ContentType, ContentStatus, Prisma, BriefStatus } from "@prisma/client";

// ─── Sub-components ───────────────────────────────────────────────────────────

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

const JOB_TYPE_LABELS: Record<string, string> = {
  CRAWL_SITE: "Crawl sito",
  SEARCH_PLATFORM: "Ricerca piattaforme",
  FULL_DISCOVERY: "Full Discovery",
};

const JOB_STATUS_LABELS: Record<string, { label: string; color: string }> = {
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
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) notFound();

  const rawSearch = await searchParams;
  const activeTab =
    rawSearch.tab === "discovery"
      ? "discovery"
      : rawSearch.tab === "analysis"
      ? "analysis"
      : rawSearch.tab === "briefs"
      ? "briefs"
      : "content";
  const isArchived = project.status === "ARCHIVED";

  // ─── Stats (always fetched) ────────────────────────────────────────────────

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

  // ─── Content tab data ──────────────────────────────────────────────────────

  let items: {
    id: string; title: string; url: string | null;
    sourcePlatform: SourcePlatform; contentType: ContentType;
    status: ContentStatus; wordCount: number | null;
    publishedAt: string | null; createdAt: string;
  }[] = [];
  let contentTotal = 0;
  let page = 1;
  const limit = 20;
  let totalPages = 0;
  let search: string | undefined;
  let sourcePlatform: SourcePlatform | undefined;
  let contentType: ContentType | undefined;
  let status: ContentStatus | undefined;
  let sortBy: "createdAt" | "title" | "publishedAt" = "createdAt";
  let sortOrder: "asc" | "desc" = "desc";
  let unfetchedCount = 0;

  if (activeTab === "content") {
    const contentQuery = ContentQuerySchema.safeParse({
      page: rawSearch.page,
      status: rawSearch.status,
      sourcePlatform: rawSearch.sourcePlatform,
      contentType: rawSearch.contentType,
      search: rawSearch.search,
      sortBy: rawSearch.sortBy,
      sortOrder: rawSearch.sortOrder,
    });

    const q = contentQuery.success
      ? contentQuery.data
      : { page: 1, limit: 20, status: undefined, sourcePlatform: undefined, contentType: undefined, search: undefined, sortBy: "createdAt" as const, sortOrder: "desc" as const };

    page = q.page;
    search = q.search;
    sourcePlatform = q.sourcePlatform;
    contentType = q.contentType;
    status = q.status;
    sortBy = q.sortBy;
    sortOrder = q.sortOrder;

    const contentWhere: Prisma.ContentItemWhereInput = {
      projectId: id,
      ...(status ? { status } : {}),
      ...(sourcePlatform ? { sourcePlatform } : {}),
      ...(contentType ? { contentType } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
    };

    const orderBy: Prisma.ContentItemOrderByWithRelationInput =
      sortBy === "title" ? { title: sortOrder }
      : sortBy === "publishedAt" ? { publishedAt: sortOrder }
      : { createdAt: sortOrder };

    const [rawItems, count, unfetchedRawContent] = await Promise.all([
      prisma.contentItem.findMany({
        where: contentWhere,
        select: {
          id: true, title: true, url: true, sourcePlatform: true,
          contentType: true, status: true, wordCount: true,
          publishedAt: true, createdAt: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contentItem.count({ where: contentWhere }),
      prisma.contentItem.count({
        where: { projectId: id, url: { not: null }, rawContent: null, status: { not: "REJECTED" } },
      }),
    ]);

    contentTotal = count;
    totalPages = Math.ceil(contentTotal / limit);
    items = rawItems.map((item) => ({
      ...item,
      publishedAt: item.publishedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    }));
    unfetchedCount = unfetchedRawContent;
  }

  // ─── Discovery tab data ────────────────────────────────────────────────────

  let latestJob: SerializedDiscoveryJob | null = null;
  let jobHistory: SerializedDiscoveryJob[] = [];
  let discoveredItems: DiscoveredItem[] = [];

  if (activeTab === "discovery") {
    const [latestRaw, historyRaw, discoveredRaw, unfetchedRaw] = await Promise.all([
      prisma.discoveryJob.findFirst({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.discoveryJob.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.contentItem.findMany({
        where: { projectId: id, status: "DISCOVERED" },
        select: {
          id: true, title: true, url: true, sourcePlatform: true,
          contentType: true, excerpt: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      // Items with URL but no rawContent (can be batch-fetched)
      prisma.contentItem.count({
        where: { projectId: id, url: { not: null }, rawContent: null, status: { not: "REJECTED" } },
      }),
    ]);

    unfetchedCount = unfetchedRaw;

    function serializeJob(j: typeof latestRaw): SerializedDiscoveryJob | null {
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

    latestJob = serializeJob(latestRaw);
    jobHistory = historyRaw.map((j) => serializeJob(j)!);
    discoveredItems = discoveredRaw.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  // ─── Analysis tab data ─────────────────────────────────────────────────────

  let projectScore: SerializedProjectScore | null = null;
  let latestAnalysisJob: SerializedAnalysisJob | null = null;
  let entities: EntityItem[] = [];
  let entityPaginationTotal = 0;
  let entityTotalPages = 0;
  let entityPage = 1;
  let entityType = "ALL";
  let topics: TopicItem[] = [];
  let contentHealth: ContentHealth = {
    total: 0, withRawContent: 0, avgWordCount: null,
    approved: 0, discovered: 0, rejected: 0, archived: 0,
  };
  let gapData: GapAnalysisData = {
    missingPlatforms: [], weakPlatforms: [], lowCoverageEntities: [],
    thinTopics: [], freshContent: 0, agingContent: 0, staleContent: 0,
    totalWithDate: 0, approvedCount: 0,
  };

  // ─── Briefs tab data ───────────────────────────────────────────────────────

  let briefs: BriefItem[] = [];
  let briefsTotal = 0;
  let briefsActiveStatus = "PENDING,ACCEPTED";
  let hasActiveBriefsJob = false;
  let latestBriefsJob: SerializedAnalysisJob | null = null;

  if (activeTab === "briefs") {
    const briefStatusParam = typeof rawSearch.briefStatus === "string"
      ? rawSearch.briefStatus
      : "PENDING,ACCEPTED";
    briefsActiveStatus = briefStatusParam;

    const VALID = new Set(["PENDING", "ACCEPTED", "REJECTED", "DONE"]);
    const statuses = briefStatusParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => VALID.has(s)) as BriefStatus[];

    const [rawBriefs, briefsCount, activeBriefsJobRaw, latestBriefsJobRaw] = await Promise.all([
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

    briefs = rawBriefs.map((b) => ({
      ...b,
      keyPoints: b.keyPoints as string[],
      entities: b.entities as string[],
      generatedAt: b.generatedAt.toISOString(),
      createdAt: b.createdAt.toISOString(),
    }));
    briefsTotal = briefsCount;
    hasActiveBriefsJob = activeBriefsJobRaw !== null;
    latestBriefsJob = latestBriefsJobRaw
      ? {
          ...latestBriefsJobRaw,
          resultSummary: latestBriefsJobRaw.resultSummary as Record<string, unknown> | null,
          startedAt: latestBriefsJobRaw.startedAt?.toISOString() ?? null,
          completedAt: latestBriefsJobRaw.completedAt?.toISOString() ?? null,
          createdAt: latestBriefsJobRaw.createdAt.toISOString(),
        }
      : null;
  }

  if (activeTab === "analysis") {
    entityPage = Math.max(1, Number(rawSearch.entityPage) || 1);
    entityType = typeof rawSearch.entityType === "string" ? rawSearch.entityType : "ALL";
    const entityLimit = 20;

    const entityWhere = {
      projectId: id,
      ...(entityType && entityType !== "ALL" ? { type: entityType as never } : {}),
      NOT: { type: "TOPIC" as never },
    };

    const [
      rawScore,
      rawLatestJob,
      rawEntities,
      rawEntityTotal,
      rawTopics,
      rawHealthStats,
      rawWordCount,
    ] = await Promise.all([
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
          id: true, label: true, frequency: true,
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
    ]);

    const now = new Date();
    const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [withRawCount, freshCount, agingCount, staleCount, totalWithDateCount] = await Promise.all([
      prisma.contentItem.count({ where: { projectId: id, rawContent: { not: null } } }),
      prisma.contentItem.count({ where: { projectId: id, publishedAt: { gte: sixMonthsAgo } } }),
      prisma.contentItem.count({ where: { projectId: id, publishedAt: { gte: twelveMonthsAgo, lt: sixMonthsAgo } } }),
      prisma.contentItem.count({ where: { projectId: id, publishedAt: { lt: twelveMonthsAgo } } }),
      prisma.contentItem.count({ where: { projectId: id, publishedAt: { not: null } } }),
    ]);

    const statusHealthMap = Object.fromEntries(
      rawHealthStats.map((r) => [r.status, r._count._all])
    ) as Record<string, number>;

    projectScore = rawScore
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

    latestAnalysisJob = rawLatestJob
      ? {
          ...rawLatestJob,
          resultSummary: rawLatestJob.resultSummary as Record<string, unknown> | null,
          startedAt: rawLatestJob.startedAt?.toISOString() ?? null,
          completedAt: rawLatestJob.completedAt?.toISOString() ?? null,
          createdAt: rawLatestJob.createdAt.toISOString(),
        }
      : null;

    entities = rawEntities.map((e) => ({ ...e, type: e.type as string }));
    entityPaginationTotal = rawEntityTotal;
    entityTotalPages = Math.ceil(rawEntityTotal / entityLimit);
    topics = rawTopics as TopicItem[];
    const approvedCount = statusHealthMap["APPROVED"] ?? 0;
    contentHealth = {
      total: totalCount,
      withRawContent: withRawCount,
      avgWordCount: rawWordCount._avg.wordCount ?? null,
      approved: approvedCount,
      discovered: statusHealthMap["DISCOVERED"] ?? 0,
      rejected: statusHealthMap["REJECTED"] ?? 0,
      archived: statusHealthMap["ARCHIVED"] ?? 0,
    };

    // ── Gap analysis ─────────────────────────────────────────────────────────

    // All known platforms vs those with content
    const allPlatforms = Object.keys(PLATFORM_LABELS) as SourcePlatform[];
    const platformsWithContent = new Set(byPlatform.map((r) => r.sourcePlatform));
    const missingPlatforms = allPlatforms
      .filter((p) => p !== "OTHER" && !platformsWithContent.has(p))
      .map((p) => ({ platform: p, label: PLATFORM_LABELS[p] }));
    const weakPlatforms = byPlatform
      .filter((r) => r.sourcePlatform !== "OTHER" && r._count._all <= 2)
      .map((r) => ({ platform: r.sourcePlatform, label: PLATFORM_LABELS[r.sourcePlatform], count: r._count._all }));

    // Topic depth: topics with frequency < 3
    const thinTopics = rawTopics
      .filter((t) => t.frequency < 3)
      .map((t) => ({ label: t.label, count: t.frequency }));

    // Low-coverage entities: top-10 non-TOPIC entities with coverage < 25% of approved
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

    gapData = {
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
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
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
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {activeTab === "discovery" ? (
                <StartDiscoveryDialog
                  projectId={project.id}
                  projectDomain={project.domain}
                  hasActiveJob={
                    latestJob !== null &&
                    (latestJob.status === "PENDING" || latestJob.status === "RUNNING")
                  }
                />
              ) : (
                <>
                  <AddContentDialog projectId={project.id} />
                  <CsvImportDialog projectId={project.id} />
                </>
              )}
              <EditProjectDialog project={project} />
              <ArchiveProjectButton
                projectId={project.id}
                projectName={project.name}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Contenuti totali" value={totalCount} />
        <StatCard label="Approvati" value={statusMap["APPROVED"] ?? 0} />
        <StatCard label="Da revisionare" value={statusMap["DISCOVERED"] ?? 0} />
        <StatCard label="Piattaforme" value={byPlatform.length} />
      </div>

      {/* ── Tab navigation ── */}
      <div className="border-b">
        <nav className="flex gap-0">
          <Link
            href={`/projects/${id}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "content"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Contenuti
            {totalCount > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({totalCount})</span>
            )}
          </Link>
          <Link
            href={`/projects/${id}?tab=discovery`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "discovery"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Discovery
            {(statusMap["DISCOVERED"] ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                {statusMap["DISCOVERED"]}
              </span>
            )}
          </Link>
          <Link
            href={`/projects/${id}?tab=analysis`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "analysis"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Analisi
          </Link>
          <Link
            href={`/projects/${id}?tab=briefs`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "briefs"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Brief
          </Link>
        </nav>
      </div>

      {/* ══ CONTENT TAB ══════════════════════════════════════════════════════════ */}
      {activeTab === "content" && (
        <>
          {/* Breakdown cards */}
          {totalCount > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Per piattaforma</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {byPlatform.map((r) => (
                    <div key={r.sourcePlatform} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{PLATFORM_LABELS[r.sourcePlatform]}</span>
                      <span className="font-medium">{r._count._all}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Per tipo</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {byType.map((r) => (
                    <div key={r.contentType} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{TYPE_LABELS[r.contentType]}</span>
                      <span className="font-medium">{r._count._all}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Per status</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {byStatus.map((r) => (
                    <div key={r.status} className="flex items-center justify-between text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      <span className="font-medium">{r._count._all}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Content list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">
                Contenuti
                {contentTotal > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({contentTotal})
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <FetchContentButton projectId={id} unfetchedCount={unfetchedCount} />
                {!isArchived && totalCount === 0 && (
                  <AddContentDialog projectId={project.id} />
                )}
              </div>
            </div>

            {totalCount === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <h3 className="mb-1 text-lg font-semibold">Nessun contenuto</h3>
                <p className="text-sm text-muted-foreground">
                  Aggiungi contenuti manualmente o avvia un Discovery per trovarli automaticamente.
                </p>
              </div>
            ) : (
              <>
                <ContentFilters
                  initialSearch={search ?? ""}
                  initialPlatform={sourcePlatform ?? ""}
                  initialType={contentType ?? ""}
                  initialStatus={status ?? ""}
                />

                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nessun contenuto corrisponde ai filtri selezionati.
                    </p>
                  </div>
                ) : (
                  <ContentTable items={items} projectId={project.id} />
                )}

                <ContentPagination page={page} totalPages={totalPages} total={contentTotal} />
              </>
            )}
          </div>
        </>
      )}

      {/* ══ DISCOVERY TAB ════════════════════════════════════════════════════════ */}
      {activeTab === "discovery" && (
        <div className="space-y-8">
          {/* Current job status */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Stato corrente</h2>
            <DiscoveryJobStatus projectId={id} initialJob={latestJob} />
          </section>

          {/* Discovered items for review */}
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold">
                Da revisionare
                {(statusMap["DISCOVERED"] ?? 0) > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({statusMap["DISCOVERED"]})
                  </span>
                )}
              </h2>
              <FetchContentButton projectId={id} unfetchedCount={unfetchedCount} />
            </div>
            <DiscoveryReview
              items={discoveredItems}
              projectId={id}
              totalDiscovered={statusMap["DISCOVERED"] ?? 0}
            />
          </section>

          {/* Job history */}
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
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Avviato</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Completato</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Trovati</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {jobHistory.map((job) => {
                      const statusCfg = JOB_STATUS_LABELS[job.status] ?? JOB_STATUS_LABELS["PENDING"];
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
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                              {statusCfg.label}
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
      )}

      {/* ══ ANALYSIS TAB ══════════════════════════════════════════════════════════ */}
      {activeTab === "analysis" && (
        <div className="space-y-6">
          {/* Current job status (auto-polling) */}
          {latestAnalysisJob && (
            <AnalysisJobStatus
              projectId={id}
              initialJob={latestAnalysisJob}
            />
          )}

          {/* Score + Health grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ScoreCard
              projectId={id}
              score={projectScore}
              hasContent={totalCount > 0}
            />
            <ContentHealthCard health={contentHealth} />
          </div>

          {/* Gap analysis */}
          <GapAnalysisCard data={gapData} />

          {/* Semantic search */}
          <SemanticSearchPanel projectId={id} />

          {/* Batch suggestions trigger */}
          {totalCount > 0 && (
            <div className="flex justify-end">
              <GenerateSuggestionsButton projectId={id} />
            </div>
          )}

          <EntitiesPanel
            projectId={id}
            entities={entities}
            activeType={entityType}
            page={entityPage}
            totalPages={entityTotalPages}
            total={entityPaginationTotal}
          />

          <TopicsPanel topics={topics} />
        </div>
      )}

      {/* ══ BRIEFS TAB ═══════════════════════════════════════════════════════════ */}
      {activeTab === "briefs" && (
        <div className="space-y-6">
          {/* Job status polling */}
          {latestBriefsJob && (
            <AnalysisJobStatus projectId={id} initialJob={latestBriefsJob} />
          )}

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Content Brief</h2>
              <p className="text-xs text-muted-foreground">
                Guide di scrittura generate automaticamente dai gap del tuo contenuto.
              </p>
            </div>
            <GenerateBriefsButton projectId={id} hasActiveBriefsJob={hasActiveBriefsJob} />
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["PENDING,ACCEPTED", "PENDING", "ACCEPTED", "DONE", "REJECTED"] as const).map((s) => (
              <a
                key={s}
                href={`/projects/${id}?tab=briefs&briefStatus=${s}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  briefsActiveStatus === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s === "PENDING,ACCEPTED" ? "Attivi" : s === "PENDING" ? "Da fare" : s === "ACCEPTED" ? "Accettati" : s === "DONE" ? "Fatti" : "Scartati"}
              </a>
            ))}
          </div>

          <BriefsPanel
            projectId={id}
            initialBriefs={briefs}
            initialTotal={briefsTotal}
            activeStatus={briefsActiveStatus}
          />
        </div>
      )}

      {/* ── Project meta ── */}
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
