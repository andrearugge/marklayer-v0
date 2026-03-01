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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddContentDialog } from "../add-content-dialog";
import { CsvImportDialog } from "../csv-import-dialog";
import { ContentFilters } from "../content-filters";
import { ContentPagination } from "../content-pagination";
import { ContentTable } from "../content-table";
import { FetchContentButton } from "../fetch-content-button";
import { FileText, Radar } from "lucide-react";
import type { SourcePlatform, ContentType, ContentStatus, Prisma } from "@prisma/client";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ContentPage({ params, searchParams }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) notFound();

  const isArchived = project.status === "ARCHIVED";
  const rawSearch = await searchParams;
  const limit = 50;

  // ── Parse query ─────────────────────────────────────────────────────────────

  const contentQuery = ContentQuerySchema.safeParse({
    page: rawSearch.page,
    status: rawSearch.status,
    sourcePlatform: rawSearch.sourcePlatform,
    contentType: rawSearch.contentType,
    search: rawSearch.search,
    sortBy: rawSearch.sortBy,
    sortOrder: rawSearch.sortOrder,
    fetchStatus: rawSearch.fetchStatus,
  });

  const q = contentQuery.success
    ? contentQuery.data
    : {
        page: 1,
        limit,
        status: undefined,
        sourcePlatform: undefined,
        contentType: undefined,
        search: undefined,
        sortBy: "createdAt" as const,
        sortOrder: "desc" as const,
        fetchStatus: undefined,
      };

  const { page, search, sourcePlatform, contentType, status, sortBy, sortOrder, fetchStatus } =
    q;

  // ── Fetch data ───────────────────────────────────────────────────────────────

  const contentWhere: Prisma.ContentItemWhereInput = {
    projectId: id,
    ...(status ? { status } : {}),
    ...(sourcePlatform ? { sourcePlatform } : {}),
    ...(contentType ? { contentType } : {}),
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
    ...(fetchStatus === "fetched" ? { rawContent: { not: null } } : {}),
    ...(fetchStatus === "pending"
      ? { rawContent: null, fetchError: null, url: { not: null } }
      : {}),
    ...(fetchStatus === "error" ? { fetchError: { not: null } } : {}),
  };

  const orderBy: Prisma.ContentItemOrderByWithRelationInput =
    sortBy === "title"
      ? { title: sortOrder }
      : sortBy === "publishedAt"
      ? { publishedAt: sortOrder }
      : { createdAt: sortOrder };

  const [rawItems, contentTotal, totalCount, byPlatform, byType, byStatus, unfetchedCount, fetchErrorCount] =
    await Promise.all([
      prisma.contentItem.findMany({
        where: contentWhere,
        select: {
          id: true,
          title: true,
          url: true,
          sourcePlatform: true,
          contentType: true,
          status: true,
          wordCount: true,
          publishedAt: true,
          createdAt: true,
          rawContent: true,
          fetchError: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contentItem.count({ where: contentWhere }),
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
      prisma.contentItem.count({
        where: {
          projectId: id,
          url: { not: null },
          rawContent: null,
          status: { not: "REJECTED" },
        },
      }),
      prisma.contentItem.count({
        where: { projectId: id, fetchError: { not: null } },
      }),
    ]);

  const totalPages = Math.ceil(contentTotal / limit);
  const items = rawItems.map(({ rawContent, ...item }) => ({
    ...item,
    hasRawContent: rawContent !== null,
    fetchError: item.fetchError ?? null,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  }));

  const statusMap = Object.fromEntries(
    byStatus.map((r) => [r.status, r._count._all])
  ) as Partial<Record<ContentStatus, number>>;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Contenuti</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount > 0
              ? `${totalCount} contenut${totalCount === 1 ? "o" : "i"} nel progetto`
              : "Nessun contenuto ancora"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <FetchContentButton projectId={id} unfetchedCount={unfetchedCount} />
          {!isArchived && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${id}/content/discovery`}>
                  <Radar className="h-3.5 w-3.5 mr-1.5" />
                  Discovery
                </Link>
              </Button>
              <AddContentDialog projectId={id} />
              <CsvImportDialog projectId={id} />
            </>
          )}
        </div>
      </div>

      {/* ── Breakdown cards (shown only when there's content) ── */}
      {totalCount > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Per piattaforma</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {byPlatform.map((r) => (
                <div
                  key={r.sourcePlatform}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {PLATFORM_LABELS[r.sourcePlatform as SourcePlatform]}
                  </span>
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
                <div
                  key={r.contentType}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {TYPE_LABELS[r.contentType as ContentType]}
                  </span>
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
                <div
                  key={r.status}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status as ContentStatus]}`}
                  >
                    {STATUS_LABELS[r.status as ContentStatus]}
                  </span>
                  <span className="font-medium">{r._count._all}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Content list ── */}
      <div className="space-y-4">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-1 text-lg font-semibold">Nessun contenuto</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Aggiungi contenuti manualmente o avvia una Discovery per trovarli automaticamente.
            </p>
            {!isArchived && (
              <div className="flex gap-2">
                <AddContentDialog projectId={id} />
                <Button asChild variant="outline">
                  <Link href={`/projects/${id}/content/discovery`}>
                    <Radar className="h-4 w-4 mr-1.5" />
                    Avvia Discovery
                  </Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground">
                {contentTotal} risultat{contentTotal === 1 ? "o" : "i"}
                {(statusMap["DISCOVERED"] ?? 0) > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    {statusMap["DISCOVERED"]} da revisionare
                  </span>
                )}
              </p>
            </div>

            <ContentFilters
              initialSearch={search ?? ""}
              initialPlatform={(sourcePlatform as string) ?? ""}
              initialType={(contentType as string) ?? ""}
              initialStatus={(status as string) ?? ""}
              initialFetchStatus={(fetchStatus as string) ?? ""}
            />

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Nessun contenuto corrisponde ai filtri selezionati.
                </p>
              </div>
            ) : (
              <ContentTable
                items={items}
                projectId={id}
                fetchErrorCount={fetchErrorCount}
                totalFilteredCount={contentTotal}
                currentFilters={{
                  status: (status as string) || undefined,
                  sourcePlatform: (sourcePlatform as string) || undefined,
                  contentType: (contentType as string) || undefined,
                  search: search || undefined,
                  fetchStatus: (fetchStatus as string) || undefined,
                }}
              />
            )}

            <ContentPagination page={page} totalPages={totalPages} total={contentTotal} />
          </>
        )}
      </div>
    </div>
  );
}
