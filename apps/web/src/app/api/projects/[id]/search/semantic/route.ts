/**
 * POST /api/projects/:id/search/semantic
 * Body: { query: string; k?: number }
 * Returns: { data: [{id, title, excerpt, score, url}], query, count }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";

type RouteParams = { params: Promise<{ id: string }> };

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? "";

const BodySchema = z.object({
  query: z.string().min(1).max(500),
  k: z.number().int().min(1).max(20).default(10),
});

interface RawResult {
  id: string;
  title: string;
  rawContent: string | null;
  url: string | null;
  distance: number;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  const { id: projectId } = await params;
  const project = await assertProjectOwnership(projectId, user.id);
  if (!project) {
    return NextResponse.json(
      { error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid request body", code: "VALIDATION_ERROR" } },
      { status: 400 }
    );
  }

  const { query, k } = parsed.data;

  // 1. Embed the query via engine
  let embedding: number[] = [];
  try {
    const engineRes = await fetch(`${ENGINE_URL}/api/embed/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-engine-api-key": ENGINE_API_KEY,
      },
      body: JSON.stringify({ text: query }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!engineRes.ok) {
      return NextResponse.json(
        { error: { message: "Embedding engine non disponibile.", code: "ENGINE_ERROR" } },
        { status: 502 }
      );
    }

    const data = (await engineRes.json()) as { embedding: number[] };
    embedding = data.embedding;
  } catch {
    return NextResponse.json(
      { error: { message: "Il servizio AI non è raggiungibile.", code: "ENGINE_UNAVAILABLE" } },
      { status: 502 }
    );
  }

  if (embedding.length === 0) {
    return NextResponse.json(
      { error: { message: "Impossibile generare l'embedding per la query.", code: "EMBED_FAILED" } },
      { status: 500 }
    );
  }

  // 2. pgvector cosine distance search
  const vectorLiteral = `[${embedding.join(",")}]`;

  const rows = await prisma.$queryRawUnsafe<RawResult[]>(
    `SELECT id, title, "rawContent", url,
            (embedding <=> $1::vector) AS distance
     FROM content_items
     WHERE project_id = $2
       AND embedding IS NOT NULL
       AND status = 'APPROVED'
     ORDER BY distance
     LIMIT $3`,
    vectorLiteral,
    projectId,
    k
  );

  // 3. Filter by distance < 0.7 (similarity > 0.3) and build response
  const results = rows
    .filter((r) => Number(r.distance) < 0.7)
    .map((r) => ({
      id: r.id,
      title: r.title,
      excerpt: r.rawContent ? r.rawContent.slice(0, 200).trim() + (r.rawContent.length > 200 ? "…" : "") : null,
      score: Math.round((1 - Number(r.distance)) * 100),
      url: r.url,
    }));

  return NextResponse.json({
    data: results,
    query,
    count: results.length,
  });
}
