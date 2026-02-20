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

const VALID_PLATFORMS = [
  "SUBSTACK",
  "MEDIUM",
  "LINKEDIN",
  "REDDIT",
  "YOUTUBE",
  "TWITTER",
  "QUORA",
  "NEWS",
  "WEBSITE",
  "OTHER",
] as const;

type SearchPlatform = (typeof VALID_PLATFORMS)[number];

const SearchRequestSchema = z.object({
  brand: z.string().min(1).max(200),
  domain: z.string().optional(),
  platforms: z
    .array(z.enum(VALID_PLATFORMS))
    .min(1)
    .max(VALID_PLATFORMS.length),
  maxResultsPerPlatform: z.number().int().min(1).max(10).default(10),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

const PLATFORM_TO_SOURCE: Record<SearchPlatform, SourcePlatform> = {
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

const PLATFORM_TO_CONTENT_TYPE: Record<SearchPlatform, ContentType> = {
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

// ─── Engine response types ────────────────────────────────────────────────────

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
      { error: { message: "Cannot search for an archived project", code: "PROJECT_ARCHIVED" } },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = SearchRequestSchema.safeParse(body);
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

  const { brand, domain, platforms, maxResultsPerPlatform } = parsed.data;

  // ── Call the Python engine ──
  const engineUrl = process.env.ENGINE_URL ?? "http://localhost:8000";
  const engineApiKey = process.env.ENGINE_API_KEY ?? "";

  let engineData: EngineSearchResponse;
  try {
    const engineRes = await fetch(`${engineUrl}/api/search/platform`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-engine-api-key": engineApiKey,
      },
      body: JSON.stringify({
        brand,
        domain: domain ?? null,
        platforms,
        max_results_per_platform: maxResultsPerPlatform,
      }),
      signal: AbortSignal.timeout(120_000), // 2 min for multi-platform search
    });

    if (!engineRes.ok) {
      const err = await engineRes.json().catch(() => ({}));
      const detail = (err as { detail?: string }).detail;
      const status = engineRes.status === 503 ? 503 : 502;
      return NextResponse.json(
        { error: { message: detail ?? "Engine error", code: "ENGINE_ERROR" } },
        { status }
      );
    }

    engineData = (await engineRes.json()) as EngineSearchResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Engine service unreachable";
    return NextResponse.json(
      { error: { message: msg, code: "ENGINE_UNAVAILABLE" } },
      { status: 503 }
    );
  }

  // ── Persist results ──
  const items = engineData.results.map((r) => {
    const platform = r.platform as SearchPlatform;
    return {
      projectId,
      url: r.url,
      title: r.title.slice(0, 500),
      sourcePlatform: PLATFORM_TO_SOURCE[platform] ?? ("OTHER" as SourcePlatform),
      contentType: PLATFORM_TO_CONTENT_TYPE[platform] ?? ("ARTICLE" as ContentType),
      rawContent: null,
      excerpt: r.snippet ?? null,
      wordCount: null,
      publishedAt: null,
      contentHash: hashUrl(r.url),
      discoveryMethod: "AGENT_SEARCH" as const,
      status: "DISCOVERED" as const,
    };
  });

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
      method: "search",
      brand,
      domain: domain ?? null,
      platforms,
      created: dbResult.count,
      skipped: items.length - dbResult.count,
      totalFound: engineData.total_found,
      engineErrors: engineData.errors,
    },
  });

  return NextResponse.json({
    data: {
      created: dbResult.count,
      skipped: items.length - dbResult.count,
      totalFound: engineData.total_found,
      errors: engineData.errors,
    },
  });
}
