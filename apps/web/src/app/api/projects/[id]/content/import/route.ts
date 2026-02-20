import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";
import { SourcePlatform, ContentType } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 1_000;

// ─── CSV row schema ───────────────────────────────────────────────────────────
// All values come as strings from PapaParse; sourcePlatform/contentType are
// pre-normalized to UPPER_CASE before parsing.

const CsvRowSchema = z.object({
  url: z.string().optional(),
  title: z.string().min(1, "title obbligatorio").max(500),
  sourcePlatform: z.nativeEnum(SourcePlatform),
  contentType: z.nativeEnum(ContentType),
  publishedAt: z.string().optional(),
});

function computeHash(input: string): string {
  return createHash("sha256").update(input.trim()).digest("hex");
}

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
          message: "Impossibile importare in un progetto archiviato",
          code: "PROJECT_ARCHIVED",
        },
      },
      { status: 400 }
    );
  }

  // ── Parse multipart form ──────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: { message: "Richiesta non valida (multipart atteso)", code: "INVALID_REQUEST" } },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: { message: "Nessun file CSV trovato nel campo 'file'", code: "NO_FILE" } },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: { message: "File troppo grande (max 5 MB)", code: "FILE_TOO_LARGE" } },
      { status: 400 }
    );
  }

  // ── Read and parse CSV ────────────────────────────────────────────────────
  const text = await file.text();

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return NextResponse.json(
      { error: { message: "File CSV non valido o vuoto", code: "INVALID_CSV" } },
      { status: 400 }
    );
  }

  const rows = parsed.data.slice(0, MAX_ROWS);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: { message: "Il file CSV non contiene righe di dati", code: "EMPTY_CSV" } },
      { status: 400 }
    );
  }

  // ── Validate each row ─────────────────────────────────────────────────────
  const errors: { row: number; message: string }[] = [];
  const validItems: {
    projectId: string;
    title: string;
    url: string | null;
    sourcePlatform: SourcePlatform;
    contentType: ContentType;
    publishedAt: Date | null;
    contentHash: string | null;
    discoveryMethod: "CSV_IMPORT";
    status: "DISCOVERED";
  }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNumber = i + 2; // +2 because row 1 = header

    // Normalize enum values to UPPER_CASE for case-insensitive matching
    const normalized = {
      url: raw.url?.trim() || undefined,
      title: raw.title?.trim() ?? "",
      sourcePlatform: (raw.sourcePlatform ?? "").trim().toUpperCase(),
      contentType: (raw.contentType ?? "").trim().toUpperCase(),
      publishedAt: raw.publishedAt?.trim() || undefined,
    };

    const result = CsvRowSchema.safeParse(normalized);
    if (!result.success) {
      const first = result.error.issues[0];
      const field = first.path.join(".") || "riga";
      errors.push({ row: rowNumber, message: `${field}: ${first.message}` });
      continue;
    }

    const { url, title, sourcePlatform, contentType, publishedAt } = result.data;

    // Validate publishedAt if provided
    let parsedDate: Date | null = null;
    if (publishedAt) {
      const d = new Date(publishedAt);
      if (isNaN(d.getTime())) {
        errors.push({ row: rowNumber, message: `publishedAt: data non valida "${publishedAt}"` });
        continue;
      }
      parsedDate = d;
    }

    const contentHash = url ? computeHash(url) : null;

    validItems.push({
      projectId,
      title,
      url: url ?? null,
      sourcePlatform,
      contentType,
      publishedAt: parsedDate,
      contentHash,
      discoveryMethod: "CSV_IMPORT",
      status: "DISCOVERED",
    });
  }

  // ── Bulk insert (skip duplicates via unique constraint) ───────────────────
  let importedCount = 0;
  let skippedCount = 0;

  if (validItems.length > 0) {
    const result = await prisma.contentItem.createMany({
      data: validItems,
      skipDuplicates: true,
    });
    importedCount = result.count;
    skippedCount = validItems.length - result.count;
  }

  await logAuditEvent({
    action: AUDIT_ACTIONS.CONTENT_IMPORTED,
    actorId: currentUser.id,
    actorEmail: currentUser.email ?? undefined,
    targetId: projectId,
    metadata: {
      imported: importedCount,
      skipped: skippedCount,
      errors: errors.length,
      totalRows: rows.length,
    },
  });

  return NextResponse.json({
    data: {
      imported: importedCount,
      skipped: skippedCount,
      errors,
    },
  });
}
