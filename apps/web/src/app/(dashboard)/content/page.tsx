import { redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PLATFORM_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/content-labels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GlobalContentFilters } from "./filters";
import type { SourcePlatform, ContentType, ContentStatus } from "@prisma/client";
import { z } from "zod";

// ─── Query schema ──────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  page:           z.coerce.number().int().positive().default(1),
  search:         z.string().trim().optional(),
  projectId:      z.string().optional(),
  status:         z.nativeEnum({ DISCOVERED: "DISCOVERED", APPROVED: "APPROVED", REJECTED: "REJECTED", ARCHIVED: "ARCHIVED" } as Record<ContentStatus, ContentStatus>).optional().catch(undefined),
  sourcePlatform: z.nativeEnum({ WEBSITE: "WEBSITE", SUBSTACK: "SUBSTACK", MEDIUM: "MEDIUM", LINKEDIN: "LINKEDIN", REDDIT: "REDDIT", YOUTUBE: "YOUTUBE", TWITTER: "TWITTER", NEWS: "NEWS", QUORA: "QUORA", OTHER: "OTHER" } as Record<SourcePlatform, SourcePlatform>).optional().catch(undefined),
  contentType:    z.nativeEnum({ ARTICLE: "ARTICLE", BLOG_POST: "BLOG_POST", PAGE: "PAGE", SOCIAL_POST: "SOCIAL_POST", COMMENT: "COMMENT", MENTION: "MENTION", VIDEO: "VIDEO", PODCAST: "PODCAST", OTHER: "OTHER" } as Record<ContentType, ContentType>).optional().catch(undefined),
});

const LIMIT = 25;

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = await searchParams;
  const query = QuerySchema.parse(raw);
  const { page, search, projectId, status, sourcePlatform, contentType } = query;

  // Build Prisma where — always scoped to userId via project relation
  const baseWhere = {
    project: {
      userId: user.id,
      ...(projectId ? { id: projectId } : {}),
    },
    ...(status         ? { status }         : {}),
    ...(sourcePlatform ? { sourcePlatform } : {}),
    ...(contentType    ? { contentType }    : {}),
    ...(search         ? { title: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [items, total, userProjects] = await Promise.all([
    prisma.contentItem.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
      select: {
        id: true,
        title: true,
        url: true,
        sourcePlatform: true,
        contentType: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.contentItem.count({ where: baseWhere }),
    prisma.project.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.ceil(total / LIMIT);
  const hasFilters = !!(search || projectId || status || sourcePlatform || contentType);

  function buildPageHref(p: number) {
    const sp = new URLSearchParams(raw);
    if (p > 1) sp.set("page", String(p)); else sp.delete("page");
    const qs = sp.toString();
    return `/content${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contenuti</h1>
        <p className="text-muted-foreground">
          Tutti i contenuti dei tuoi progetti in un'unica vista.
        </p>
      </div>

      {/* Filters */}
      <GlobalContentFilters projects={userProjects} />

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? hasFilters
            ? "Nessun contenuto corrisponde ai filtri."
            : "Nessun contenuto ancora."
          : `${total} contenut${total === 1 ? "o" : "i"}`}
      </p>

      {/* Table */}
      {items.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titolo</TableHead>
                <TableHead className="hidden md:table-cell">Progetto</TableHead>
                <TableHead className="hidden sm:table-cell">Piattaforma</TableHead>
                <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[260px]">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <Link
                        href={`/projects/${item.project.id}/content/${item.id}`}
                        className="text-sm font-medium hover:underline underline-offset-4 truncate"
                      >
                        {item.title}
                      </Link>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link
                      href={`/projects/${item.project.id}`}
                      className="text-sm text-muted-foreground hover:underline underline-offset-4"
                    >
                      {item.project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {PLATFORM_LABELS[item.sourcePlatform]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {TYPE_LABELS[item.contentType]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-right text-sm text-muted-foreground tabular-nums">
                    {(item.publishedAt ?? item.createdAt).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Empty state (no filters) */}
      {items.length === 0 && !hasFilters && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Nessun contenuto ancora.{" "}
            <Link href="/projects" className="underline underline-offset-4 hover:text-foreground">
              Vai ai progetti →
            </Link>
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Link
            href={buildPageHref(page - 1)}
            aria-disabled={page <= 1}
            className={`text-sm px-3 py-1.5 rounded border transition-colors ${
              page <= 1
                ? "text-muted-foreground pointer-events-none border-transparent"
                : "hover:bg-secondary border-border"
            }`}
          >
            ← Precedente
          </Link>
          <span className="text-sm text-muted-foreground">
            Pagina {page} di {totalPages}
          </span>
          <Link
            href={buildPageHref(page + 1)}
            aria-disabled={page >= totalPages}
            className={`text-sm px-3 py-1.5 rounded border transition-colors ${
              page >= totalPages
                ? "text-muted-foreground pointer-events-none border-transparent"
                : "hover:bg-secondary border-border"
            }`}
          >
            Successiva →
          </Link>
        </div>
      )}
    </div>
  );
}
