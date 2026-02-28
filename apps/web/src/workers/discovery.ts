/**
 * Discovery Worker — standalone process, run with:
 *   npm run worker --workspace=apps/web
 *
 * Picks up jobs from the "discovery" BullMQ queue and:
 *   1. Marks DiscoveryJob as RUNNING
 *   2. Calls the Python engine (crawl / search)
 *   3. Persists results as ContentItems
 *   4. Marks DiscoveryJob as COMPLETED or FAILED
 */

import path from "node:path";
import { createHash } from "node:crypto";
import { config } from "dotenv";

// Load env before any other import that might need env vars
config({ path: path.resolve(process.cwd(), ".env.local") });

import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Prisma, SourcePlatform, ContentType } from "@prisma/client";
// scoring helpers (no @/ alias — relative path for standalone worker process)

// Worker only needs the queue names and types; `import type` is erased at runtime
// so we avoid instantiating the Queues in this process.
import { DISCOVERY_QUEUE_NAME, ANALYSIS_QUEUE_NAME } from "../lib/queue";
import type {
  DiscoveryJobPayload,
  CrawlSitePayload,
  SearchPlatformPayload,
  AnalysisJobPayload,
  ExtractEntitiesPayload,
  GenerateEmbeddingsPayload,
  ClusterTopicsPayload,
  ComputeScorePayload,
  FullAnalysisPayload,
} from "../lib/queue";
import { computeScoreDimensions } from "../lib/scoring";
import { generateSuggestions } from "../lib/suggestions";

// ─── Prisma (dedicated client for the worker process) ─────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Audit logging (inline — avoids double Prisma singleton) ─────────────────

async function logAudit(
  action: string,
  actorId: string,
  projectId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        actorId,
        targetId: projectId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error("[worker] Audit log failed:", err);
  }
}

// ─── Safe DB update (guard against record-not-found on stale jobs) ────────────

async function safeUpdateJob(
  id: string,
  data: Parameters<typeof prisma.discoveryJob.update>[0]["data"]
): Promise<void> {
  try {
    await prisma.discoveryJob.update({ where: { id }, data });
  } catch (err) {
    // P2025 = record not found; ignore silently, log everything else
    const code = (err as { code?: string }).code;
    if (code !== "P2025") console.error("[worker] DB update failed:", err);
  }
}

// ─── Engine config ────────────────────────────────────────────────────────────

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function detectPlatform(url: string): SourcePlatform {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("substack.com")) return "SUBSTACK";
    if (host.includes("medium.com")) return "MEDIUM";
    if (host.includes("linkedin.com")) return "LINKEDIN";
    if (host.includes("reddit.com")) return "REDDIT";
    if (host.includes("youtube.com")) return "YOUTUBE";
    if (host.includes("twitter.com") || host.includes("x.com")) return "TWITTER";
  } catch {
    // fall through
  }
  return "WEBSITE";
}

function detectContentType(url: string): ContentType {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (/\/(blog|post|article|news|story|insights?)/.test(pathname)) return "ARTICLE";
  } catch {
    // fall through
  }
  return "PAGE";
}

// ─── Engine response types ────────────────────────────────────────────────────

interface EnginePageResult {
  url: string;
  title: string | null;
  raw_content: string | null;
  word_count: number | null;
  excerpt: string | null;
  published_at: string | null;
}

interface EngineCrawlResponse {
  pages: EnginePageResult[];
  crawled_count: number;
  error_count: number;
  errors: { url: string; error: string }[];
}

interface EngineSearchResult {
  url: string;
  title: string;
  snippet: string | null;
  platform: string;
}

interface EngineSearchResponse {
  results: EngineSearchResult[];
  total_found: number;
  errors: { platform: string; error: string }[];
}

const PLATFORM_TO_SOURCE: Record<string, SourcePlatform> = {
  SUBSTACK: "SUBSTACK",
  MEDIUM: "MEDIUM",
  LINKEDIN: "LINKEDIN",
  REDDIT: "REDDIT",
  YOUTUBE: "YOUTUBE",
  TWITTER: "TWITTER",
  QUORA: "QUORA",
  NEWS: "NEWS",
  WEBSITE: "WEBSITE",
  OTHER: "OTHER",
};

const PLATFORM_TO_CONTENT_TYPE: Record<string, ContentType> = {
  SUBSTACK: "BLOG_POST",
  MEDIUM: "BLOG_POST",
  LINKEDIN: "ARTICLE",
  REDDIT: "SOCIAL_POST",
  YOUTUBE: "VIDEO",
  TWITTER: "SOCIAL_POST",
  QUORA: "COMMENT",
  NEWS: "MENTION",
  WEBSITE: "PAGE",
  OTHER: "ARTICLE",
};

// ─── Job handlers ─────────────────────────────────────────────────────────────

interface CrawlResult {
  crawledCount: number;
  created: number;
  skipped: number;
  engineErrors: number;
}

async function runCrawl(payload: CrawlSitePayload): Promise<CrawlResult> {
  const { projectId, config } = payload;
  const { siteUrl, maxDepth, maxPages, rateLimit } = config;

  const engineRes = await fetch(`${ENGINE_URL}/api/crawl/site`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-engine-api-key": ENGINE_API_KEY,
    },
    body: JSON.stringify({
      url: siteUrl,
      max_depth: maxDepth,
      max_pages: maxPages,
      rate_limit: rateLimit,
    }),
    signal: AbortSignal.timeout(300_000), // 5 min
  });

  if (!engineRes.ok) {
    const detail = await engineRes.json().catch(() => ({}));
    throw new Error(`Engine crawl failed (${engineRes.status}): ${JSON.stringify(detail)}`);
  }

  const data = (await engineRes.json()) as EngineCrawlResponse;
  const sourcePlatform = detectPlatform(siteUrl);

  const items = data.pages.map((p) => ({
    projectId,
    url: p.url,
    title: (p.title ?? p.url).slice(0, 500),
    sourcePlatform,
    contentType: detectContentType(p.url),
    rawContent: p.raw_content ?? null,
    excerpt: p.excerpt ?? null,
    wordCount: p.word_count ?? null,
    publishedAt: p.published_at ? new Date(p.published_at) : null,
    contentHash: hashUrl(p.url),
    discoveryMethod: "AGENT_CRAWL" as const,
    status: "DISCOVERED" as const,
  }));

  const result = await prisma.contentItem.createMany({ data: items, skipDuplicates: true });

  return {
    crawledCount: data.crawled_count,
    created: result.count,
    skipped: items.length - result.count,
    engineErrors: data.error_count,
  };
}

interface SearchResult {
  totalFound: number;
  created: number;
  skipped: number;
  engineErrors: number;
}

async function runSearch(payload: SearchPlatformPayload): Promise<SearchResult> {
  const { projectId, config } = payload;
  const { brand, domain, platforms, maxResultsPerPlatform } = config;

  const engineRes = await fetch(`${ENGINE_URL}/api/search/platform`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-engine-api-key": ENGINE_API_KEY,
    },
    body: JSON.stringify({
      brand,
      domain: domain ?? null,
      platforms,
      max_results_per_platform: maxResultsPerPlatform,
    }),
    signal: AbortSignal.timeout(120_000), // 2 min
  });

  if (!engineRes.ok) {
    const detail = await engineRes.json().catch(() => ({}));
    throw new Error(`Engine search failed (${engineRes.status}): ${JSON.stringify(detail)}`);
  }

  const data = (await engineRes.json()) as EngineSearchResponse;

  const items = data.results.map((r) => ({
    projectId,
    url: r.url,
    title: r.title.slice(0, 500),
    sourcePlatform: (PLATFORM_TO_SOURCE[r.platform] ?? "OTHER") as SourcePlatform,
    contentType: (PLATFORM_TO_CONTENT_TYPE[r.platform] ?? "ARTICLE") as ContentType,
    rawContent: null,
    excerpt: r.snippet ?? null,
    wordCount: null,
    publishedAt: null,
    contentHash: hashUrl(r.url),
    discoveryMethod: "AGENT_SEARCH" as const,
    status: "DISCOVERED" as const,
  }));

  const result = await prisma.contentItem.createMany({ data: items, skipDuplicates: true });

  return {
    totalFound: data.total_found,
    created: result.count,
    skipped: items.length - result.count,
    engineErrors: data.errors.length,
  };
}

// ─── Analysis job helpers ─────────────────────────────────────────────────────

async function safeUpdateAnalysisJob(
  id: string,
  data: Parameters<typeof prisma.analysisJob.update>[0]["data"]
): Promise<void> {
  try {
    await prisma.analysisJob.update({ where: { id }, data });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "P2025") console.error("[worker] Analysis DB update failed:", err);
  }
}

// ─── Engine types for extraction ──────────────────────────────────────────────

interface EngineEntityItem {
  label: string;
  type: string;
  salience: number;
  context: string | null;
}

interface EngineExtractionResult {
  id: string;
  entities: EngineEntityItem[];
  error: string | null;
}

interface EngineExtractResponse {
  results: EngineExtractionResult[];
}

// ─── EXTRACT_ENTITIES handler ─────────────────────────────────────────────────

interface ExtractResult {
  processed: number;
  entitiesFound: number;
  errors: number;
}

async function runExtractEntities(
  payload: ExtractEntitiesPayload
): Promise<ExtractResult> {
  const { projectId } = payload;

  // Fetch APPROVED items with rawContent (max 50 per engine request)
  const items = await prisma.contentItem.findMany({
    where: { projectId, status: "APPROVED", rawContent: { not: null } },
    select: { id: true, title: true, rawContent: true },
    take: 50,
  });

  if (items.length === 0) {
    return { processed: 0, entitiesFound: 0, errors: 0 };
  }

  const engineRes = await fetch(`${ENGINE_URL}/api/extract/entities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-engine-api-key": ENGINE_API_KEY,
    },
    body: JSON.stringify({
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        text: item.rawContent!,
      })),
    }),
    signal: AbortSignal.timeout(600_000), // 10 min (sequential Haiku calls)
  });

  if (!engineRes.ok) {
    const detail = await engineRes.json().catch(() => ({}));
    throw new Error(
      `Engine extract failed (${engineRes.status}): ${JSON.stringify(detail)}`
    );
  }

  const data = (await engineRes.json()) as EngineExtractResponse;
  let entitiesFound = 0;
  let errors = 0;

  for (const result of data.results) {
    if (result.error) {
      errors++;
      continue;
    }

    for (const e of result.entities) {
      const normalizedLabel = e.label.trim().toLowerCase();
      if (!normalizedLabel) continue;

      // Upsert Entity — increment frequency if already seen
      const entity = await prisma.entity.upsert({
        where: {
          projectId_normalizedLabel_type: {
            projectId,
            normalizedLabel,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: e.type as any,
          },
        },
        update: { frequency: { increment: 1 } },
        create: {
          projectId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: e.type as any,
          label: e.label.trim(),
          normalizedLabel,
          frequency: 1,
        },
      });

      // Upsert ContentEntity
      await prisma.contentEntity.upsert({
        where: {
          contentId_entityId: { contentId: result.id, entityId: entity.id },
        },
        update: { salience: e.salience, context: e.context },
        create: {
          contentId: result.id,
          entityId: entity.id,
          salience: e.salience,
          context: e.context,
        },
      });

      entitiesFound++;
    }
  }

  return { processed: items.length, entitiesFound, errors };
}

// ─── GENERATE_EMBEDDINGS handler ─────────────────────────────────────────────

interface EmbedItemResponse {
  id: string;
  embedding: number[];
  error: string | null;
}

interface EngineEmbedResponse {
  results: EmbedItemResponse[];
  dimensions: number;
}

interface EmbedResult {
  processed: number;
  errors: number;
}

const EMBED_BATCH_SIZE = 100; // items per engine request

async function runGenerateEmbeddings(
  payload: GenerateEmbeddingsPayload
): Promise<EmbedResult> {
  const { projectId } = payload;

  // Fetch items that have rawContent but no embedding yet.
  // Prisma omits the `embedding` (Unsupported type) from where input — use raw SQL.
  // Note: rawContent has no @map, so the DB column is camelCase and must be quoted.
  const items = await prisma.$queryRawUnsafe<
    { id: string; title: string; rawContent: string }[]
  >(
    `SELECT id, title, "rawContent"
     FROM content_items
     WHERE project_id = $1
       AND "rawContent" IS NOT NULL
       AND embedding IS NULL`,
    projectId
  );

  if (items.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < items.length; i += EMBED_BATCH_SIZE) {
    const batch = items.slice(i, i + EMBED_BATCH_SIZE);

    const engineRes = await fetch(`${ENGINE_URL}/api/embed/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-engine-api-key": ENGINE_API_KEY,
      },
      body: JSON.stringify({
        items: batch.map((item) => ({
          id: item.id,
          // Combine title + content for richer embedding
          text: `${item.title}. ${(item.rawContent ?? "").slice(0, 3500)}`,
        })),
      }),
      signal: AbortSignal.timeout(300_000), // 5 min per batch
    });

    if (!engineRes.ok) {
      const detail = await engineRes.json().catch(() => ({}));
      throw new Error(
        `Engine embed failed (${engineRes.status}): ${JSON.stringify(detail)}`
      );
    }

    const data = (await engineRes.json()) as EngineEmbedResponse;

    for (const result of data.results) {
      if (result.error || result.embedding.length === 0) {
        errors++;
        continue;
      }

      // pgvector requires raw SQL since Prisma doesn't support the vector type
      const embeddingStr = `[${result.embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE content_items SET embedding = $1::vector WHERE id = $2`,
        embeddingStr,
        result.id
      );
      processed++;
    }
  }

  return { processed, errors };
}

// ─── CLUSTER_TOPICS handler ───────────────────────────────────────────────────

interface EngineClusterAssignment {
  id: string;
  cluster_idx: number;
  topic_label: string;
  confidence: number;
}

interface EngineClusterResponse {
  assignments: EngineClusterAssignment[];
  clusters_found: number;
  error: string | null;
}

interface ClusterTopicsResult {
  clustersFound: number;
  itemsClustered: number;
  errors: number;
}

async function runClusterTopics(
  payload: ClusterTopicsPayload
): Promise<ClusterTopicsResult> {
  const { projectId } = payload;

  // Fetch items with embeddings — cast to text since Prisma omits Unsupported fields
  const rows = await prisma.$queryRawUnsafe<
    { id: string; title: string; embedding: string }[]
  >(
    `SELECT id, title, embedding::text AS embedding
     FROM content_items
     WHERE project_id = $1
       AND embedding IS NOT NULL`,
    projectId
  );

  if (rows.length === 0) {
    return { clustersFound: 0, itemsClustered: 0, errors: 0 };
  }

  // pgvector returns "[x,y,z,...]" which is valid JSON
  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    embedding: JSON.parse(r.embedding) as number[],
  }));

  const engineRes = await fetch(`${ENGINE_URL}/api/analyze/topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-engine-api-key": ENGINE_API_KEY,
    },
    body: JSON.stringify({
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        embedding: item.embedding,
      })),
    }),
    signal: AbortSignal.timeout(300_000), // 5 min (KMeans + LLM labeling)
  });

  if (!engineRes.ok) {
    const detail = await engineRes.json().catch(() => ({}));
    throw new Error(
      `Engine cluster failed (${engineRes.status}): ${JSON.stringify(detail)}`
    );
  }

  const data = (await engineRes.json()) as EngineClusterResponse;

  if (data.error) {
    // Soft error from engine (e.g. not enough items)
    console.warn(`[worker] Cluster topics soft error: ${data.error}`);
    return { clustersFound: 0, itemsClustered: 0, errors: 1 };
  }

  if (data.assignments.length === 0) {
    return { clustersFound: 0, itemsClustered: 0, errors: 0 };
  }

  // Remove existing TOPIC entities for this project (cascades ContentEntity)
  await prisma.entity.deleteMany({ where: { projectId, type: "TOPIC" } });

  // Deduplicate labels and create Entity records
  const uniqueLabels = [...new Set(data.assignments.map((a) => a.topic_label))];
  const labelToEntityId = new Map<string, string>();

  for (const label of uniqueLabels) {
    const entity = await prisma.entity.create({
      data: {
        projectId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: "TOPIC" as any,
        label,
        normalizedLabel: label.trim().toLowerCase(),
        frequency: 0,
      },
    });
    labelToEntityId.set(label, entity.id);
  }

  // Create ContentEntity + increment frequency per assignment
  let itemsClustered = 0;

  for (const assignment of data.assignments) {
    const entityId = labelToEntityId.get(assignment.topic_label);
    if (!entityId) continue;

    await prisma.contentEntity.create({
      data: {
        contentId: assignment.id,
        entityId,
        salience: assignment.confidence,
      },
    });

    await prisma.entity.update({
      where: { id: entityId },
      data: { frequency: { increment: 1 } },
    });

    itemsClustered++;
  }

  return { clustersFound: data.clusters_found, itemsClustered, errors: 0 };
}

// ─── COMPUTE_SCORE handler ────────────────────────────────────────────────────

import type { ScoreDimensions } from "../lib/scoring";

interface ComputeScoreResult {
  overall: number;
  dimensions: ScoreDimensions;
  suggestionsCount: number;
}

async function runComputeScore(payload: ComputeScorePayload): Promise<ComputeScoreResult> {
  const { projectId } = payload;

  // Get project name for suggestions prompt
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  const scoreResult = await computeScoreDimensions(projectId, prisma);
  const suggestions = await generateSuggestions(
    project?.name ?? "",
    scoreResult.dimensions
  );

  // Upsert ProjectScore (idempotent)
  // dimensions/suggestions must be cast to InputJsonValue for Prisma JsonB
  await prisma.projectScore.upsert({
    where: { projectId },
    create: {
      projectId,
      overallScore: scoreResult.overall,
      dimensions: scoreResult.dimensions as unknown as Prisma.InputJsonValue,
      suggestions: suggestions as unknown as Prisma.InputJsonValue,
      contentCount: scoreResult.contentCount,
      isStale: false,
      computedAt: new Date(),
    },
    update: {
      overallScore: scoreResult.overall,
      dimensions: scoreResult.dimensions as unknown as Prisma.InputJsonValue,
      suggestions: suggestions as unknown as Prisma.InputJsonValue,
      contentCount: scoreResult.contentCount,
      isStale: false,
      computedAt: new Date(),
    },
  });

  return {
    overall: scoreResult.overall,
    dimensions: scoreResult.dimensions,
    suggestionsCount: suggestions.length,
  };
}

// ─── FULL_ANALYSIS handler ────────────────────────────────────────────────────

const MIN_EMBEDDINGS_FOR_CLUSTER = 6;

interface FullAnalysisResult {
  extract: ExtractResult;
  embed: EmbedResult;
  cluster: (ClusterTopicsResult & { skipped?: boolean }) | null;
  score: ComputeScoreResult;
}

async function runFullAnalysis(
  payload: FullAnalysisPayload
): Promise<FullAnalysisResult> {
  const { projectId } = payload;

  // Step 1: Extract entities — abort if fails
  const extract = await runExtractEntities({
    ...payload,
    jobType: "EXTRACT_ENTITIES",
  });

  // Step 2: Generate embeddings — abort if fails
  const embed = await runGenerateEmbeddings({
    ...payload,
    jobType: "GENERATE_EMBEDDINGS",
  });

  // Step 3: Cluster topics — skip if < MIN_EMBEDDINGS_FOR_CLUSTER; don't abort if fails
  let cluster: (ClusterTopicsResult & { skipped?: boolean }) | null = null;
  const rows = await prisma.$queryRawUnsafe<[{ count: string }]>(
    `SELECT COUNT(*)::text AS count FROM content_items WHERE project_id = $1 AND embedding IS NOT NULL`,
    projectId
  );
  const embeddedCount = parseInt(rows[0]?.count ?? "0", 10);

  if (embeddedCount < MIN_EMBEDDINGS_FOR_CLUSTER) {
    console.log(
      `[worker] FULL_ANALYSIS: only ${embeddedCount} embeddings, skipping cluster (min ${MIN_EMBEDDINGS_FOR_CLUSTER})`
    );
    cluster = { clustersFound: 0, itemsClustered: 0, errors: 0, skipped: true };
  } else {
    try {
      cluster = await runClusterTopics({ ...payload, jobType: "CLUSTER_TOPICS" });
    } catch (err) {
      console.warn(
        "[worker] FULL_ANALYSIS: cluster step failed, continuing with score:",
        err instanceof Error ? err.message : String(err)
      );
      cluster = { clustersFound: 0, itemsClustered: 0, errors: 1, skipped: false };
    }
  }

  // Step 4: Compute score — always runs
  const score = await runComputeScore({ ...payload, jobType: "COMPUTE_SCORE" });

  return { extract, embed, cluster, score };
}

// ─── Redis connection ─────────────────────────────────────────────────────────

const redisConnection = (() => {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
      db: Number(parsed.pathname.slice(1)) || 0,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
})();

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker<DiscoveryJobPayload>(
  DISCOVERY_QUEUE_NAME,
  async (job) => {
    const payload = job.data;
    const { discoveryJobId, projectId, userId } = payload;

    console.log(
      `[worker] Starting job ${job.id} — type: ${payload.jobType}, discoveryJobId: ${discoveryJobId}`
    );

    // Mark as RUNNING
    await safeUpdateJob(discoveryJobId, { status: "RUNNING", startedAt: new Date() });
    await logAudit("discovery.job.started", userId, projectId, { jobType: payload.jobType, discoveryJobId });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resultSummary: Record<string, any>;

      if (payload.jobType === "CRAWL_SITE") {
        resultSummary = await runCrawl(payload);
      } else if (payload.jobType === "SEARCH_PLATFORM") {
        resultSummary = await runSearch(payload);
      } else {
        // FULL_DISCOVERY — optional crawl + search
        const { config } = payload;
        let crawlResult: CrawlResult | null = null;

        if (config.crawl) {
          crawlResult = await runCrawl({
            jobType: "CRAWL_SITE",
            projectId,
            userId,
            discoveryJobId,
            config: config.crawl,
          });
        }

        const searchResult = await runSearch({
          jobType: "SEARCH_PLATFORM",
          projectId,
          userId,
          discoveryJobId,
          config: {
            brand: config.brand,
            domain: config.domain,
            platforms: config.platforms,
            maxResultsPerPlatform: config.maxResultsPerPlatform,
          },
        });

        resultSummary = {
          crawl: crawlResult,
          search: searchResult,
          totalCreated: (crawlResult?.created ?? 0) + searchResult.created,
        };
      }

      await safeUpdateJob(discoveryJobId, {
        status: "COMPLETED",
        completedAt: new Date(),
        resultSummary: resultSummary as Prisma.InputJsonValue,
      });
      await logAudit("discovery.job.completed", userId, projectId, {
        jobType: payload.jobType,
        discoveryJobId,
        ...resultSummary,
      });

      console.log(`[worker] Job ${job.id} completed:`, JSON.stringify(resultSummary));
    } catch (err) {
      const isEngineDown =
        err instanceof Error &&
        (err.message.includes("fetch failed") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("Engine crawl failed") ||
          err.message.includes("Engine search failed"));

      const message = isEngineDown
        ? `Engine non raggiungibile: ${err instanceof Error ? err.message : String(err)}`
        : err instanceof Error
        ? err.message
        : String(err);

      console.error(`[worker] Job ${job.id} failed:`, message);

      await safeUpdateJob(discoveryJobId, {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
      });
      await logAudit("discovery.job.failed", userId, projectId, {
        jobType: payload.jobType,
        discoveryJobId,
        error: message,
      });

      throw err; // re-throw so BullMQ marks the job as failed
    }
  },
  { connection: redisConnection, concurrency: 2 }
);

worker.on("completed", (job) => console.log(`[worker] ✓ Job ${job.id} done`));
worker.on("failed", (job, err) =>
  console.error(`[worker] ✗ Job ${job?.id} failed:`, err.message)
);

console.log(`[worker] Discovery worker started — queue: ${DISCOVERY_QUEUE_NAME}`);

// ─── Analysis Worker ──────────────────────────────────────────────────────────

const analysisWorker = new Worker<AnalysisJobPayload>(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    const payload = job.data;
    const { analysisJobId, projectId, userId } = payload;

    console.log(
      `[worker] Starting analysis job ${job.id} — type: ${payload.jobType}, analysisJobId: ${analysisJobId}`
    );

    await safeUpdateAnalysisJob(analysisJobId, {
      status: "RUNNING",
      startedAt: new Date(),
    });
    await logAudit("analysis.job.started", userId, projectId, {
      jobType: payload.jobType,
      analysisJobId,
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resultSummary: Record<string, any>;

      if (payload.jobType === "EXTRACT_ENTITIES") {
        resultSummary = await runExtractEntities(payload);
      } else if (payload.jobType === "GENERATE_EMBEDDINGS") {
        resultSummary = await runGenerateEmbeddings(payload);
      } else if (payload.jobType === "CLUSTER_TOPICS") {
        resultSummary = await runClusterTopics(payload);
      } else if (payload.jobType === "COMPUTE_SCORE") {
        resultSummary = await runComputeScore(payload);
      } else if (payload.jobType === "FULL_ANALYSIS") {
        resultSummary = await runFullAnalysis(payload);
      } else {
        throw new Error(`Unknown analysis job type: ${(payload as { jobType: string }).jobType}`);
      }

      await safeUpdateAnalysisJob(analysisJobId, {
        status: "COMPLETED",
        completedAt: new Date(),
        resultSummary: resultSummary as Prisma.InputJsonValue,
      });
      await logAudit("analysis.job.completed", userId, projectId, {
        jobType: payload.jobType,
        analysisJobId,
        ...resultSummary,
      });

      console.log(
        `[worker] Analysis job ${job.id} completed:`,
        JSON.stringify(resultSummary)
      );
    } catch (err) {
      const isEngineDown =
        err instanceof Error &&
        (err.message.includes("fetch failed") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("Engine extract failed") ||
          err.message.includes("Engine embed failed") ||
          err.message.includes("Engine cluster failed") ||
          err.message.includes("Engine analyze failed"));

      const message = isEngineDown
        ? `Engine non raggiungibile: ${err instanceof Error ? err.message : String(err)}`
        : err instanceof Error
        ? err.message
        : String(err);

      console.error(`[worker] Analysis job ${job.id} failed:`, message);

      await safeUpdateAnalysisJob(analysisJobId, {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
      });
      await logAudit("analysis.job.failed", userId, projectId, {
        jobType: payload.jobType,
        analysisJobId,
        error: message,
      });

      throw err;
    }
  },
  { connection: redisConnection, concurrency: 1 }
);

analysisWorker.on("completed", (job) =>
  console.log(`[worker] ✓ Analysis job ${job.id} done`)
);
analysisWorker.on("failed", (job, err) =>
  console.error(`[worker] ✗ Analysis job ${job?.id} failed:`, err.message)
);

console.log(`[worker] Analysis worker started — queue: ${ANALYSIS_QUEUE_NAME}`);

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown() {
  console.log("[worker] Shutting down...");
  await worker.close();
  await analysisWorker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
