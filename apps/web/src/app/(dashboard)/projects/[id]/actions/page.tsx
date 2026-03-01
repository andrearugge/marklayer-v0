import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { GenerateSuggestionsButton } from "../generate-suggestions-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ExternalLink, Sparkles, AlertCircle } from "lucide-react";
import { PLATFORM_LABELS } from "@/lib/content-labels";
import type { SourcePlatform } from "@prisma/client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ActionsPage({ params }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) notFound();

  // ── Fetch data ───────────────────────────────────────────────────────────────

  const [projectScore, contentSuggestions, approvedCount] = await Promise.all([
    prisma.projectScore.findUnique({
      where: { projectId: id },
      select: { suggestions: true, overallScore: true, computedAt: true },
    }),
    prisma.contentSuggestion.findMany({
      where: { projectId: id },
      orderBy: { generatedAt: "desc" },
      take: 50,
      include: {
        content: {
          select: {
            id: true,
            title: true,
            url: true,
            sourcePlatform: true,
          },
        },
      },
    }),
    prisma.contentItem.count({ where: { projectId: id, status: "APPROVED" } }),
  ]);

  const strategicSuggestions = (projectScore?.suggestions ?? []) as string[];
  const hasSuggestions = strategicSuggestions.length > 0 || contentSuggestions.length > 0;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Azioni</h1>
          <p className="text-sm text-muted-foreground">
            Suggerimenti strategici e per contenuto generati dall&apos;analisi AI.
          </p>
        </div>
        <GenerateSuggestionsButton projectId={id} />
      </div>

      {/* ── Empty state ── */}
      {!hasSuggestions && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <AlertCircle className="mb-4 h-10 w-10 text-muted-foreground/40" />
          <h3 className="mb-1 text-base font-semibold">Nessun suggerimento disponibile</h3>
          <p className="mb-4 text-sm text-muted-foreground max-w-sm">
            {approvedCount === 0
              ? "Approva almeno un contenuto e avvia l'analisi AI per ricevere suggerimenti."
              : "Avvia l'analisi AI e genera i suggerimenti per vedere le azioni consigliate."}
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            <Link
              href={`/projects/${id}/analysis`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Vai all&apos;analisi
            </Link>
          </div>
        </div>
      )}

      {/* ── Strategic suggestions ── */}
      {strategicSuggestions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Suggerimenti strategici</h2>
            <Badge variant="secondary">{strategicSuggestions.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Generati dall&apos;AI sulla base del tuo AI Readiness Score.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {strategicSuggestions.map((suggestion, i) => (
              <Card key={i}>
                <CardContent className="pt-4 flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed">{suggestion}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Per-content suggestions ── */}
      {contentSuggestions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Suggerimenti per contenuto</h2>
            <Badge variant="secondary">{contentSuggestions.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Azioni specifiche per migliorare ogni singolo contenuto.
          </p>
          <div className="space-y-3">
            {contentSuggestions.map((cs) => {
              const suggestions = cs.suggestions as string[];
              return (
                <Card key={cs.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="space-y-0.5 min-w-0">
                        <CardTitle className="text-sm font-medium leading-snug truncate">
                          {cs.content.title}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {PLATFORM_LABELS[cs.content.sourcePlatform as SourcePlatform]}
                          </span>
                          {cs.content.url && (
                            <a
                              href={cs.content.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Apri
                            </a>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/projects/${id}/content/${cs.contentId}`}
                        className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        Dettaglio
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-1.5">
                      {suggestions.map((s, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                          <span className="leading-relaxed">{s}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Generato il{" "}
                      {new Date(cs.generatedAt).toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
