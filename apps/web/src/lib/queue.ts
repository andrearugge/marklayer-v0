import { Queue } from "bullmq";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrawlSiteConfig {
  siteUrl: string;
  maxDepth: number;
  maxPages: number;
  rateLimit: number;
}

export interface SearchPlatformConfig {
  brand: string;
  domain?: string;
  platforms: string[];
  maxResultsPerPlatform: number;
}

export interface FullDiscoveryConfig extends SearchPlatformConfig {
  crawl?: CrawlSiteConfig;
}

export type CrawlSitePayload = {
  jobType: "CRAWL_SITE";
  projectId: string;
  userId: string;
  discoveryJobId: string;
  config: CrawlSiteConfig;
};

export type SearchPlatformPayload = {
  jobType: "SEARCH_PLATFORM";
  projectId: string;
  userId: string;
  discoveryJobId: string;
  config: SearchPlatformConfig;
};

export type FullDiscoveryPayload = {
  jobType: "FULL_DISCOVERY";
  projectId: string;
  userId: string;
  discoveryJobId: string;
  config: FullDiscoveryConfig;
};

export type DiscoveryJobPayload =
  | CrawlSitePayload
  | SearchPlatformPayload
  | FullDiscoveryPayload;

// ─── Analysis job types ───────────────────────────────────────────────────────

export type ExtractEntitiesPayload = {
  jobType: "EXTRACT_ENTITIES";
  projectId: string;
  userId: string;
  analysisJobId: string;
};

export type GenerateEmbeddingsPayload = {
  jobType: "GENERATE_EMBEDDINGS";
  projectId: string;
  userId: string;
  analysisJobId: string;
};

export type ClusterTopicsPayload = {
  jobType: "CLUSTER_TOPICS";
  projectId: string;
  userId: string;
  analysisJobId: string;
};

export type AnalysisJobPayload =
  | ExtractEntitiesPayload
  | GenerateEmbeddingsPayload
  | ClusterTopicsPayload;

// ─── Connection ───────────────────────────────────────────────────────────────

function getRedisConnection() {
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
}

// ─── Queues ───────────────────────────────────────────────────────────────────

export const DISCOVERY_QUEUE_NAME = "discovery";

export const discoveryQueue = new Queue<DiscoveryJobPayload>(DISCOVERY_QUEUE_NAME, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

export const ANALYSIS_QUEUE_NAME = "analysis";

export const analysisQueue = new Queue<AnalysisJobPayload>(ANALYSIS_QUEUE_NAME, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});
