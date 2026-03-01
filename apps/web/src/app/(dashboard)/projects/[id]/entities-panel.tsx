import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EntityItem {
  id: string;
  label: string;
  type: string;
  frequency: number;
}

interface Props {
  projectId: string;
  entities: EntityItem[];
  activeType: string;
  page: number;
  totalPages: number;
  total: number;
}

// ─── Label maps ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  BRAND:        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  PERSON:       "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  ORGANIZATION: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  PRODUCT:      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  LOCATION:     "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  CONCEPT:      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  OTHER:        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const TYPE_LABELS: Record<string, string> = {
  ALL:          "Tutti",
  BRAND:        "Brand",
  PERSON:       "Persone",
  ORGANIZATION: "Organizzazioni",
  PRODUCT:      "Prodotti",
  LOCATION:     "Luoghi",
  CONCEPT:      "Concetti",
};

const FILTER_TYPES = ["ALL", "BRAND", "PERSON", "ORGANIZATION", "PRODUCT", "LOCATION"];

// ─── Component ────────────────────────────────────────────────────────────────

function buildHref(
  projectId: string,
  type: string,
  page: number
): string {
  const params = new URLSearchParams();
  if (type && type !== "ALL") params.set("entityType", type);
  if (page > 1) params.set("entityPage", String(page));
  const qs = params.toString();
  return `/projects/${projectId}/analysis${qs ? `?${qs}` : ""}`;
}

export function EntitiesPanel({ projectId, entities, activeType, page, totalPages, total }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Entità estratte
          {total > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-1">({total})</span>
          )}
        </CardTitle>

        {/* Type filter tabs */}
        <div className="flex gap-1 flex-wrap mt-2">
          {FILTER_TYPES.map((type) => {
            const isActive = activeType === type || (type === "ALL" && !activeType);
            return (
              <Link
                key={type}
                href={buildHref(projectId, type, 1)}
                className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {TYPE_LABELS[type] ?? type}
              </Link>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {entities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nessuna entità trovata. Avvia l'estrazione entità per popolare questo pannello.
          </p>
        ) : (
          <div className="space-y-1">
            {entities.map((entity) => (
              <div
                key={entity.id}
                className="flex items-center justify-between py-1.5 px-0 border-b last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium shrink-0 ${
                      TYPE_COLORS[entity.type] ?? TYPE_COLORS.OTHER
                    }`}
                  >
                    {entity.type.slice(0, 4)}
                  </span>
                  <span className="text-sm truncate">{entity.label}</span>
                </div>
                <span className="text-xs text-muted-foreground ml-2 shrink-0 tabular-nums">
                  ×{entity.frequency}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <Link
              href={buildHref(projectId, activeType, page - 1)}
              aria-disabled={page <= 1}
              className={`text-sm px-2 py-1 rounded transition-colors ${
                page <= 1
                  ? "text-muted-foreground pointer-events-none"
                  : "hover:bg-secondary"
              }`}
            >
              ← Precedente
            </Link>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Link
              href={buildHref(projectId, activeType, page + 1)}
              aria-disabled={page >= totalPages}
              className={`text-sm px-2 py-1 rounded transition-colors ${
                page >= totalPages
                  ? "text-muted-foreground pointer-events-none"
                  : "hover:bg-secondary"
              }`}
            >
              Successiva →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
