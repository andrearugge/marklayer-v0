"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreDimensions {
  copertura: number;
  profondita: number;
  freschezza: number;
  autorita: number;
  coerenza: number;
}

export interface SerializedProjectScore {
  id: string;
  overallScore: number;
  dimensions: ScoreDimensions;
  suggestions: string[] | null;
  contentCount: number;
  isStale: boolean;
  computedAt: string;
}

interface Props {
  projectId: string;
  score: SerializedProjectScore | null;
  hasContent: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(v: number): string {
  if (v < 40) return "text-red-600 dark:text-red-400";
  if (v < 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

function progressColor(v: number): string {
  if (v < 40) return "[&>div]:bg-red-500";
  if (v < 70) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-green-500";
}

const DIMENSION_LABELS: Record<keyof ScoreDimensions, string> = {
  copertura:  "Copertura",
  profondita: "Profondità",
  freschezza: "Freschezza",
  autorita:   "Autorevolezza",
  coerenza:   "Coerenza",
};

const DIMENSION_WEIGHTS: Record<keyof ScoreDimensions, string> = {
  copertura:  "25%",
  profondita: "25%",
  freschezza: "20%",
  autorita:   "15%",
  coerenza:   "15%",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ScoreCard({ projectId, score, hasContent }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analysis/start`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Analisi avviata — aggiorna la pagina tra qualche secondo.");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data?.error?.message ?? "Impossibile avviare l'analisi.");
      }
    } catch {
      toast.error("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            AI Readiness Score
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {score?.isStale && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">
                Score non aggiornato
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={loading || !hasContent}
              onClick={handleStart}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Avvia Analisi
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {!score ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nessuna analisi eseguita</p>
            <p className="text-xs mt-1">
              {hasContent
                ? "Clicca «Avvia Analisi» per calcolare il tuo score."
                : "Aggiungi contenuti al progetto per avviare l'analisi."}
            </p>
          </div>
        ) : (
          <>
            {/* Overall score */}
            <div className="flex items-center gap-5">
              <span className={`text-5xl font-bold tabular-nums ${scoreColor(score.overallScore)}`}>
                {score.overallScore}
              </span>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>su 100</p>
                <p>
                  Calcolato il{" "}
                  {new Date(score.computedAt).toLocaleString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p>{score.contentCount} contenuti analizzati</p>
              </div>
            </div>

            {/* Dimensions */}
            <div className="space-y-3">
              {(Object.keys(DIMENSION_LABELS) as (keyof ScoreDimensions)[]).map((key) => {
                const val = score.dimensions[key] ?? 0;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {DIMENSION_LABELS[key]}
                        <span className="ml-1 text-xs opacity-60">({DIMENSION_WEIGHTS[key]})</span>
                      </span>
                      <span className={`font-semibold tabular-nums ${scoreColor(val)}`}>
                        {val}
                      </span>
                    </div>
                    <Progress value={val} className={`h-1.5 ${progressColor(val)}`} />
                  </div>
                );
              })}
            </div>

            {/* Suggestions */}
            {score.suggestions && score.suggestions.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Suggerimenti
                </p>
                <ul className="space-y-1.5">
                  {score.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
