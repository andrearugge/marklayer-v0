import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContentHealth {
  total: number;
  withRawContent: number;
  avgWordCount: number | null;
  approved: number;
  discovered: number;
  rejected: number;
  archived: number;
}

interface Props {
  health: ContentHealth;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContentHealthCard({ health }: Props) {
  const rawPct =
    health.total > 0
      ? Math.round((health.withRawContent / health.total) * 100)
      : 0;

  const approvedPct =
    health.total > 0
      ? Math.round((health.approved / health.total) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Salute dei contenuti
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {health.total === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nessun contenuto nel progetto.
          </p>
        ) : (
          <>
            {/* Text extracted */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Testo estratto</span>
                <span className="font-medium">
                  {health.withRawContent} / {health.total} ({rawPct}%)
                </span>
              </div>
              <Progress value={rawPct} className="h-1.5" />
            </div>

            {/* Avg word count */}
            {health.avgWordCount !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Parole in media</span>
                <span className="font-medium tabular-nums">
                  {Math.round(health.avgWordCount)}
                </span>
              </div>
            )}

            {/* Approved ratio */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Approvati</span>
                <span className="font-medium">
                  {health.approved} ({approvedPct}%)
                </span>
              </div>
              <Progress
                value={approvedPct}
                className="h-1.5 [&>div]:bg-green-500"
              />
            </div>

            {/* Status breakdown */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {[
                { label: "Da revisionare", value: health.discovered, color: "text-yellow-600" },
                { label: "Rifiutati",      value: health.rejected,   color: "text-red-500" },
                { label: "Archiviati",     value: health.archived,   color: "text-gray-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className={`text-xs font-medium tabular-nums ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
