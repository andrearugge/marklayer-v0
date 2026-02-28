import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GapAnalysisData {
  missingPlatforms: Array<{ platform: string; label: string }>;
  weakPlatforms: Array<{ platform: string; label: string; count: number }>;
  lowCoverageEntities: Array<{ label: string; type: string; frequency: number }>;
  thinTopics: Array<{ label: string; count: number }>;
  freshContent: number;   // publishedAt < 6 months ago
  agingContent: number;   // publishedAt 6-12 months ago
  staleContent: number;   // publishedAt > 12 months ago
  totalWithDate: number;  // items with publishedAt set
  approvedCount: number;
}

type Severity = "critical" | "warning" | "ok";

interface GapItem {
  label: string;
  detail: string;
  severity: Severity;
}

// ─── Key platforms where AI-visibility matters most ───────────────────────────

const KEY_PLATFORMS = new Set(["WEBSITE", "LINKEDIN", "MEDIUM", "SUBSTACK", "YOUTUBE", "NEWS"]);

// ─── Gap derivation ────────────────────────────────────────────────────────────

function buildGaps(data: GapAnalysisData): GapItem[] {
  const gaps: GapItem[] = [];

  // 1. Platform gaps — missing key platforms
  const criticalMissing = data.missingPlatforms.filter((p) => KEY_PLATFORMS.has(p.platform));
  if (criticalMissing.length > 0) {
    gaps.push({
      label: `Assenza su ${criticalMissing.length} piattaform${criticalMissing.length === 1 ? "a" : "e"} chiave`,
      detail: criticalMissing.map((p) => p.label).join(", "),
      severity: "warning",
    });
  }

  // 2. Weak platform presence
  for (const p of data.weakPlatforms) {
    if (KEY_PLATFORMS.has(p.platform)) {
      gaps.push({
        label: `Presenza debole su ${p.label}`,
        detail: `Solo ${p.count} contenut${p.count === 1 ? "o" : "i"} — aumenta la copertura`,
        severity: "warning",
      });
    }
  }

  // 3. Thin topic clusters
  for (const t of data.thinTopics) {
    gaps.push({
      label: `Topic "${t.label}" poco coperto`,
      detail: `Solo ${t.count} contenut${t.count === 1 ? "o" : "i"} su questo argomento`,
      severity: t.count <= 1 ? "critical" : "warning",
    });
  }

  // 4. Low-coverage entities (only when enough approved content to be meaningful)
  if (data.approvedCount >= 5) {
    for (const e of data.lowCoverageEntities) {
      const pct = Math.round((e.frequency / data.approvedCount) * 100);
      gaps.push({
        label: `"${e.label}" citato raramente`,
        detail: `Presente solo nel ${pct}% dei contenuti approvati — aumenta la copertura`,
        severity: pct < 10 ? "critical" : "warning",
      });
    }
  }

  // 5. Freshness gaps
  if (data.totalWithDate > 0) {
    const stalePct = Math.round((data.staleContent / data.totalWithDate) * 100);
    if (stalePct > 50) {
      gaps.push({
        label: "Contenuto prevalentemente datato",
        detail: `${stalePct}% dei contenuti è più vecchio di 12 mesi — aggiorna o produci nuovi contenuti`,
        severity: "critical",
      });
    } else if (stalePct > 25) {
      gaps.push({
        label: "Parte del contenuto è datata",
        detail: `${stalePct}% dei contenuti supera i 12 mesi di età`,
        severity: "warning",
      });
    }

    if (data.freshContent === 0) {
      gaps.push({
        label: "Nessun contenuto recente",
        detail: "Nessun contenuto pubblicato negli ultimi 6 mesi — la freschezza è cruciale per la visibilità AI",
        severity: "critical",
      });
    } else if (data.freshContent < 3 && data.approvedCount >= 5) {
      gaps.push({
        label: "Pochi contenuti recenti",
        detail: `Solo ${data.freshContent} contenut${data.freshContent === 1 ? "o" : "i"} negli ultimi 6 mesi`,
        severity: "warning",
      });
    }
  }

  return gaps;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<Severity, { row: string; icon: string }> = {
  critical: {
    row: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800",
    icon: "text-red-500",
  },
  warning: {
    row: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800",
    icon: "text-yellow-500",
  },
  ok: {
    row: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
    icon: "text-green-500",
  },
};

function GapRow({ item }: { item: GapItem }) {
  const s = SEVERITY_STYLES[item.severity];
  const Icon =
    item.severity === "critical"
      ? AlertTriangle
      : item.severity === "warning"
      ? Info
      : CheckCircle2;

  return (
    <div className={`flex items-start gap-3 rounded-md border p-3 ${s.row}`}>
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${s.icon}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{item.label}</p>
        <p className="text-xs text-muted-foreground">{item.detail}</p>
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function GapAnalysisCard({ data }: { data: GapAnalysisData }) {
  if (data.approvedCount === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Gap Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Approva dei contenuti e avvia un&apos;analisi per vedere le lacune.
          </p>
        </CardContent>
      </Card>
    );
  }

  const gaps = buildGaps(data);
  const criticalCount = gaps.filter((g) => g.severity === "critical").length;
  const warningCount = gaps.filter((g) => g.severity === "warning").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Gap Analysis
          </CardTitle>

          {criticalCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400 shrink-0">
              {criticalCount} critic{criticalCount === 1 ? "o" : "i"}
            </span>
          )}
          {criticalCount === 0 && warningCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 shrink-0">
              {warningCount} avvis{warningCount === 1 ? "o" : "i"}
            </span>
          )}
          {gaps.length === 0 && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400 shrink-0">
              Nessuna lacuna
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {gaps.length === 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 p-3 dark:bg-green-950/20 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">
              Ottimo lavoro! Nessuna lacuna significativa rilevata.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {gaps.map((gap, i) => (
              <GapRow key={i} item={gap} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
