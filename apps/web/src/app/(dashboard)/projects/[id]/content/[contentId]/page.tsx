import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { EditContentDialog } from "./edit-content-dialog";
import { ChangeStatusSelect } from "./change-status-select";
import { DeleteContentButton } from "./delete-content-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import {
  PLATFORM_LABELS,
  TYPE_LABELS,
  DISCOVERY_LABELS,
} from "@/lib/content-labels";
import { FetchSingleButton } from "./fetch-single-button";
import { ContentSuggestionsCard } from "./content-suggestions-card";

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ id: string; contentId: string }>;
};

export default async function ContentDetailPage({ params }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id: projectId, contentId } = await params;
  const project = await assertProjectOwnership(projectId, currentUser.id);
  if (!project) notFound();

  const [item, suggestion] = await Promise.all([
    prisma.contentItem.findFirst({ where: { id: contentId, projectId } }),
    prisma.contentSuggestion.findUnique({ where: { contentId } }),
  ]);
  if (!item) notFound();

  // Format publishedAt as YYYY-MM-DD for the edit form date input
  const publishedAtStr = item.publishedAt
    ? new Date(item.publishedAt).toISOString().split("T")[0]
    : null;

  const editItemProps = {
    id: item.id,
    projectId,
    title: item.title,
    url: item.url,
    sourcePlatform: item.sourcePlatform,
    contentType: item.contentType,
    rawContent: item.rawContent,
    publishedAt: publishedAtStr,
  };

  return (
    <div className="space-y-6">
      {/* ── Back link ── */}
      <Link
        href={`/projects/${projectId}/content`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Contenuti
      </Link>

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight leading-snug">
            {item.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{PLATFORM_LABELS[item.sourcePlatform]}</Badge>
            <span className="text-sm text-muted-foreground">
              {TYPE_LABELS[item.contentType]}
            </span>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Apri URL
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ChangeStatusSelect
            projectId={projectId}
            contentId={item.id}
            currentStatus={item.status}
          />
          <EditContentDialog item={editItemProps} />
          <DeleteContentButton
            projectId={projectId}
            contentId={item.id}
            contentTitle={item.title}
          />
        </div>
      </div>

      {/* ── Main grid: content + sidebar ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Contenuto</CardTitle>
            </CardHeader>
            <CardContent>
              {item.rawContent ? (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground">
                  {item.rawContent}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                  <FileText className="h-10 w-10 text-muted-foreground/30" />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Contenuto non ancora estratto.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.url
                        ? "Clicca il pulsante per estrarre il testo dalla pagina, oppure incollalo tramite Modifica."
                        : "Questo contenuto non ha un URL — incolla il testo tramite Modifica."}
                    </p>
                  </div>
                  {item.url && <FetchSingleButton projectId={projectId} />}
                </div>
              )}
            </CardContent>
          </Card>

          {item.excerpt && !item.rawContent && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Estratto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">{item.excerpt}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: suggestions + metadata */}
        <div className="space-y-4">
        <ContentSuggestionsCard
          projectId={projectId}
          contentId={item.id}
          initialSuggestion={
            suggestion
              ? {
                  suggestions: suggestion.suggestions as string[],
                  generatedAt: suggestion.generatedAt.toISOString(),
                }
              : null
          }
        />
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Metadati</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <MetaRow
              label="Status"
              value={
                <ChangeStatusSelect
                  projectId={projectId}
                  contentId={item.id}
                  currentStatus={item.status}
                />
              }
            />
            <MetaRow
              label="Parole"
              value={
                item.wordCount
                  ? item.wordCount.toLocaleString("it-IT")
                  : "—"
              }
            />
            <MetaRow label="Lingua" value={item.language ?? "—"} />
            <MetaRow
              label="Pubblicato"
              value={
                item.publishedAt
                  ? new Date(item.publishedAt).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <MetaRow
              label="Aggiunto"
              value={new Date(item.createdAt).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            />
            <MetaRow
              label="Aggiornato"
              value={new Date(item.updatedAt).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            />
            <MetaRow
              label="Sorgente"
              value={DISCOVERY_LABELS[item.discoveryMethod]}
            />
            {item.contentHash && (
              <MetaRow
                label="Hash"
                value={
                  <span
                    className="font-mono text-xs text-muted-foreground truncate block max-w-[140px]"
                    title={item.contentHash}
                  >
                    {item.contentHash.slice(0, 12)}…
                  </span>
                }
              />
            )}
            {item.lastCrawledAt && (
              <MetaRow
                label="Ultima scansione"
                value={new Date(item.lastCrawledAt).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              />
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
