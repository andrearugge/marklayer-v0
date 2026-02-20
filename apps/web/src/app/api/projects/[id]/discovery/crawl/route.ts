import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";
import type { SourcePlatform, ContentType } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

// ─── Validation ───────────────────────────────────────────────────────────────

const CrawlRequestSchema = z.object({
  siteUrl: z.string().url(),
  maxDepth: z.number().int().min(1).max(5).default(2),
  maxPages: z.number().int().min(1).max(200).default(50),
  rateLimit: z.number().min(0.1).max(10).default(1.0),
});

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
    // malformed URL — fall through to default
  }
  return "WEBSITE";
}

function detectContentType(url: string): ContentType {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/\/(blog|post|article|news|story|insights?)/.test(path)) return "ARTICLE";
  } catch {
    // fall through
  }
  return "PAGE";
}

// ─── Engine response types ────────────────────────────────────────────────────

interface EnginePageResult {
  url: string;
  title: string | null;
  description: string | null;
  raw_content: string | null;
  word_count: number | null;
  excerpt: string | null;
  published_at: string | null; // YYYY-MM-DD
}

interface EngineCrawlResponse {
  pages: EnginePageResult[];
  crawled_count: number;
  error_count: number;
  errors: { url: string; error: string }[];
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id: projectId } = await params;
  const project = await assertProjectOwnership(projectId, currentUser.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  if (project.status === "ARCHIVED") {
    return NextResponse.json(
      { error: { message: "Cannot crawl an archived project", code: "PROJECT_ARCHIVED" } },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = CrawlRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: "Dati non validi",
          code: "INVALID_DATA",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { siteUrl, maxDepth, maxPages, rateLimit } = parsed.data;

  // ── Call the Python engine ──
  const engineUrl = process.env.ENGINE_URL ?? "http://localhost:8000";
  const engineApiKey = process.env.ENGINE_API_KEY ?? "";

  let engineData: EngineCrawlResponse;
  try {
    const engineRes = await fetch(`${engineUrl}/api/crawl/site`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-engine-api-key": engineApiKey,
      },
      body: JSON.stringify({
        url: siteUrl,
        max_depth: maxDepth,
        max_pages: maxPages,
        rate_limit: rateLimit,
      }),
      // Server-side fetch: allow longer timeout for crawl jobs
      signal: AbortSignal.timeout(300_000), // 5 min
    });

    if (!engineRes.ok) {
      const err = await engineRes.json().catch(() => ({}));
      const detail = (err as { detail?: string }).detail;
      return NextResponse.json(
        { error: { message: detail ?? "Engine error", code: "ENGINE_ERROR" } },
        { status: 502 }
      );
    }

    engineData = (await engineRes.json()) as EngineCrawlResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Engine service unreachable";
    return NextResponse.json(
      { error: { message: msg, code: "ENGINE_UNAVAILABLE" } },
      { status: 503 }
    );
  }

  // ── Persist results ──
  const sourcePlatform = detectPlatform(siteUrl);

  const items = engineData.pages.map((page) => ({
    projectId,
    url: page.url,
    title: (page.title ?? page.url).slice(0, 500),
    sourcePlatform,
    contentType: detectContentType(page.url),
    rawContent: page.raw_content ?? null,
    excerpt: page.excerpt ?? null,
    wordCount: page.word_count ?? null,
    publishedAt: page.published_at ? new Date(page.published_at) : null,
    contentHash: hashUrl(page.url),
    discoveryMethod: "AGENT_CRAWL" as const,
    status: "DISCOVERED" as const,
  }));

  const dbResult = await prisma.contentItem.createMany({
    data: items,
    skipDuplicates: true,
  });

  await logAuditEvent({
    action: AUDIT_ACTIONS.CONTENT_DISCOVERED,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: projectId,
    metadata: {
      siteUrl,
      created: dbResult.count,
      skipped: items.length - dbResult.count,
      crawledCount: engineData.crawled_count,
      errorCount: engineData.error_count,
    },
  });

  return NextResponse.json({
    data: {
      created: dbResult.count,
      skipped: items.length - dbResult.count,
      crawledCount: engineData.crawled_count,
      errors: engineData.errors,
    },
  });
}
