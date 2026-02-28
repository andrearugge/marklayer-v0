import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { discoveryQueue } from "@/lib/queue";
import type { DiscoveryJobPayload } from "@/lib/queue";

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

const CrawlConfigSchema = z.object({
  siteUrl: z.string().url(),
  maxDepth: z.number().int().min(1).max(5).default(2),
  maxPages: z.number().int().min(1).max(200).default(50),
  rateLimit: z.number().min(0.1).max(10).default(1.0),
});

const SearchConfigSchema = z.object({
  brand: z.string().min(1).max(200),
  domain: z.string().optional(),
  platforms: z.array(z.enum(VALID_PLATFORMS)).min(1),
  maxResultsPerPlatform: z.number().int().min(1).max(10).default(10),
});

const StartDiscoverySchema = z.discriminatedUnion("jobType", [
  z.object({
    jobType: z.literal("CRAWL_SITE"),
    config: CrawlConfigSchema,
  }),
  z.object({
    jobType: z.literal("SEARCH_PLATFORM"),
    config: SearchConfigSchema,
  }),
  z.object({
    jobType: z.literal("FULL_DISCOVERY"),
    config: SearchConfigSchema.extend({
      crawl: CrawlConfigSchema.optional(),
    }),
  }),
]);

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
      {
        error: {
          message: "Cannot run discovery on an archived project",
          code: "PROJECT_ARCHIVED",
        },
      },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = StartDiscoverySchema.safeParse(body);
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

  const { jobType, config } = parsed.data;

  // Create the DiscoveryJob record (PENDING)
  const discoveryJob = await prisma.discoveryJob.create({
    data: {
      projectId,
      jobType,
      status: "PENDING",
      config: config as Prisma.InputJsonValue,
    },
  });

  // Enqueue BullMQ job
  const queuePayload: DiscoveryJobPayload = {
    ...parsed.data,
    projectId,
    userId: currentUser.id,
    discoveryJobId: discoveryJob.id,
  } as DiscoveryJobPayload;

  await discoveryQueue.add(jobType, queuePayload);

  return NextResponse.json(
    { data: { discoveryJobId: discoveryJob.id, status: "PENDING" } },
    { status: 202 }
  );
}
