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

// Worker only needs the queue name and types; `import type` is erased at runtime
// so we avoid instantiating the Queue in this process.
import { DISCOVERY_QUEUE_NAME } from "../lib/queue";
import type { DiscoveryJobPayload, CrawlSitePayload, SearchPlatformPayload } from "../lib/queue";

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

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown() {
  console.log("[worker] Shutting down...");
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
