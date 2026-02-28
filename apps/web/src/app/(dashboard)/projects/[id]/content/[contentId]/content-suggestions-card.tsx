"use client";

import { useState } from "react";
import { Loader2, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ContentSuggestion {
  suggestions: string[];
  generatedAt: string;
}

interface Props {
  projectId: string;
  contentId: string;
  initialSuggestion: ContentSuggestion | null;
}

export function ContentSuggestionsCard({ projectId, contentId, initialSuggestion }: Props) {
  const router = useRouter();
  const [suggestion, setSuggestion] = useState<ContentSuggestion | null>(initialSuggestion);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentId}/suggestions`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Errore durante la generazione.");
        return;
      }
      setSuggestion({
        suggestions: data.data.suggestions as string[],
        generatedAt: data.data.generatedAt as string,
      });
      toast.success("Suggerimenti generati.");
      router.refresh();
    } catch {
      toast.error("Servizio AI non raggiungibile.");
    } finally {
      setLoading(false);
    }
  }

  const formattedDate = suggestion?.generatedAt
    ? new Date(suggestion.generatedAt).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            Suggerimenti AI
          </CardTitle>
          {suggestion && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={generate}
              disabled={loading}
              title="Rigenera suggerimenti"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading && !suggestion && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Generazione in corso…
          </div>
        )}

        {!loading && !suggestion && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ottieni suggerimenti concreti per migliorare questo contenuto e aumentarne
              la visibilità nei sistemi AI.
            </p>
            <Button size="sm" variant="outline" onClick={generate} className="w-full">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Genera Suggerimenti
            </Button>
          </div>
        )}

        {suggestion && (
          <div className="space-y-2">
            <ul className="space-y-2">
              {(suggestion.suggestions as string[]).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-violet-500 font-bold shrink-0 mt-0.5">✦</span>
                  <span className="text-foreground leading-snug">{s}</span>
                </li>
              ))}
            </ul>
            {formattedDate && (
              <p className="text-xs text-muted-foreground pt-1 border-t">
                Generato il {formattedDate}
              </p>
            )}
            {loading && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Rigenerazione in corso…
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
