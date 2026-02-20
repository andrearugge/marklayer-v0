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
import { EditProjectDialog } from "./edit-project-dialog";
import { ArchiveProjectButton } from "./archive-project-button";
import { AddContentDialog } from "./add-content-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { ContentFilters } from "./content-filters";
import { ContentPagination } from "./content-pagination";
import { ContentTable } from "./content-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, FileText, ArrowLeft } from "lucide-react";
import type { SourcePlatform, ContentType, ContentStatus, Prisma } from "@prisma/client";

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) notFound();

  // Parse content list query params
  const rawSearch = await searchParams;
  const contentQuery = ContentQuerySchema.safeParse({
    page: rawSearch.page,
    status: rawSearch.status,
    sourcePlatform: rawSearch.sourcePlatform,
    contentType: rawSearch.contentType,
    search: rawSearch.search,
    sortBy: rawSearch.sortBy,
    sortOrder: rawSearch.sortOrder,
  });

  const {
    page,
    limit,
    status,
    sourcePlatform,
    contentType,
    search,
    sortBy,
    sortOrder,
  } = contentQuery.success
    ? contentQuery.data
    : {
        page: 1,
        limit: 20,
        status: undefined,
        sourcePlatform: undefined,
        contentType: undefined,
        search: undefined,
        sortBy: "createdAt" as const,
        sortOrder: "desc" as const,
      };

  const contentWhere: Prisma.ContentItemWhereInput = {
    projectId: id,
    ...(status ? { status } : {}),
    ...(sourcePlatform ? { sourcePlatform } : {}),
    ...(contentType ? { contentType } : {}),
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
  };

  const orderBy: Prisma.ContentItemOrderByWithRelationInput =
    sortBy === "title"
      ? { title: sortOrder }
      : sortBy === "publishedAt"
      ? { publishedAt: sortOrder }
      : { createdAt: sortOrder };

  const [totalCount, byPlatform, byType, byStatus, items, contentTotal] =
    await Promise.all([
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
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contentItem.count({ where: contentWhere }),
    ]);

  const totalPages = Math.ceil(contentTotal / limit);
  const statusMap = Object.fromEntries(
    byStatus.map((r) => [r.status, r._count._all])
  ) as Partial<Record<ContentStatus, number>>;

  const isArchived = project.status === "ARCHIVED";

  // Serialize dates for client components (Next.js JSON serialization)
  const serializedItems = items.map((item) => ({
    ...item,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="space-y-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tutti i progetti
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {project.name}
              </h1>
              {isArchived && <Badge variant="secondary">Archiviato</Badge>}
            </div>
            {project.domain && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <a
                  href={
                    project.domain.startsWith("http")
                      ? project.domain
                      : `https://${project.domain}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors hover:underline"
                >
                  {project.domain}
                </a>
              </div>
            )}
            {project.description && (
              <p className="text-sm text-muted-foreground max-w-xl">
                {project.description}
              </p>
            )}
          </div>

          {!isArchived && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <AddContentDialog projectId={project.id} />
              <CsvImportDialog projectId={project.id} />
              <EditProjectDialog project={project} />
              <ArchiveProjectButton
                projectId={project.id}
                projectName={project.name}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Contenuti totali" value={totalCount} />
        <StatCard label="Approvati" value={statusMap["APPROVED"] ?? 0} />
        <StatCard label="Da revisionare" value={statusMap["DISCOVERED"] ?? 0} />
        <StatCard label="Piattaforme" value={byPlatform.length} />
      </div>

      {/* ── Breakdown cards ── */}
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
                    {PLATFORM_LABELS[r.sourcePlatform]}
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
                    {TYPE_LABELS[r.contentType]}
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
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}
                  >
                    {STATUS_LABELS[r.status]}
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Contenuti
            {contentTotal > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({contentTotal})
              </span>
            )}
          </h2>
          {!isArchived && totalCount === 0 && (
            <AddContentDialog projectId={project.id} />
          )}
        </div>

        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-1 text-lg font-semibold">Nessun contenuto</h3>
            <p className="text-sm text-muted-foreground">
              Aggiungi contenuti per iniziare a tracciare la tua visibilità online.
            </p>
          </div>
        ) : (
          <>
            <ContentFilters
              initialSearch={search ?? ""}
              initialPlatform={sourcePlatform ?? ""}
              initialType={contentType ?? ""}
              initialStatus={status ?? ""}
            />

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Nessun contenuto corrisponde ai filtri selezionati.
                </p>
              </div>
            ) : (
              <ContentTable items={serializedItems} projectId={project.id} />
            )}

            <ContentPagination
              page={page}
              totalPages={totalPages}
              total={contentTotal}
            />
          </>
        )}
      </div>

      {/* ── Project meta ── */}
      <div className="text-xs text-muted-foreground border-t pt-4">
        Creato il{" "}
        {new Date(project.createdAt).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
        {" · "}
        Ultimo aggiornamento{" "}
        {new Date(project.updatedAt).toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </div>
    </div>
  );
}
