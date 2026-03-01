"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Search, Loader2, AlertTriangle, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SearchResult {
  id: string;
  title: string;
  excerpt: string | null;
  score: number;
  url: string | null;
}

interface Props {
  projectId: string;
}

export function SemanticSearchPanel({ projectId }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/search/semantic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, k: 10 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Errore durante la ricerca.");
        return;
      }
      setResults(data.data as SearchResult[]);
      setLastQuery(data.query as string);
    } catch {
      setError("Servizio AI non raggiungibile.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !loading) handleSearch();
  }

  const hasResults = results !== null;
  const isEmpty = hasResults && results.length === 0;
  const isWeak = hasResults && results.length > 0 && results.length < 3;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <FileSearch className="h-3.5 w-3.5 text-blue-500" />
          Ricerca Semantica
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            {loading ? (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Cerca un topic o concetto…"
              className="pl-9"
              disabled={loading}
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            size="sm"
          >
            Cerca
          </Button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {/* Results */}
        {hasResults && (
          <div className="space-y-3">
            {/* Coverage warning */}
            {isWeak && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:bg-yellow-950/20 dark:border-yellow-800">
                <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  Questo topic non è ben coperto nel tuo content portfolio ({results.length}{" "}
                  contenut{results.length === 1 ? "o" : "i"} rilevante{results.length === 1 ? "" : "i"}).
                </p>
              </div>
            )}

            {/* Empty */}
            {isEmpty && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                <Search className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">Nessun contenuto trovato</p>
                <p className="text-xs text-muted-foreground mt-1">
                  &ldquo;{lastQuery}&rdquo; non è coperto nel tuo portfolio — considera di creare un brief.
                </p>
              </div>
            )}

            {/* Result list */}
            {results.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {results.length} risultat{results.length === 1 ? "o" : "i"} per &ldquo;{lastQuery}&rdquo;
                </p>
                {results.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/projects/${projectId}/content/${r.id}`}
                          className="text-sm font-medium hover:underline truncate"
                        >
                          {r.title}
                        </Link>
                      </div>
                      {r.excerpt && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {r.excerpt}
                        </p>
                      )}
                    </div>
                    {/* Similarity badge */}
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                        r.score >= 70
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : r.score >= 50
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.score}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Blank state (before first search) */}
        {!hasResults && !error && !loading && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Digita un topic o concetto per scoprire quanto è coperto nel tuo portfolio.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
