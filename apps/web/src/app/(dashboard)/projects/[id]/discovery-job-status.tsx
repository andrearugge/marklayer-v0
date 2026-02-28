"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedDiscoveryJob {
  id: string;
  projectId: string;
  jobType: string;
  status: string;
  config: Record<string, unknown> | null;
  resultSummary: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<string, string> = {
  CRAWL_SITE: "Crawl sito",
  SEARCH_PLATFORM: "Ricerca piattaforme",
  FULL_DISCOVERY: "Full Discovery",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  PENDING: {
    label: "In attesa",
    variant: "secondary",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  RUNNING: {
    label: "In esecuzione",
    variant: "default",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  COMPLETED: {
    label: "Completato",
    variant: "outline",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  },
  FAILED: {
    label: "Fallito",
    variant: "destructive",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  CANCELLED: {
    label: "Annullato",
    variant: "secondary",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ResultSummary({ summary }: { summary: Record<string, unknown> | null }) {
  if (!summary) return null;

  // CRAWL_SITE summary
  if ("crawledCount" in summary) {
    return (
      <div className="flex gap-4 text-sm mt-3 text-muted-foreground">
        <span>🔍 Scansionate: <strong className="text-foreground">{summary.crawledCount as number}</strong></span>
        <span>✅ Salvate: <strong className="text-foreground">{summary.created as number}</strong></span>
        <span>⏭ Già presenti: <strong className="text-foreground">{summary.skipped as number}</strong></span>
      </div>
    );
  }

  // SEARCH_PLATFORM summary
  if ("totalFound" in summary) {
    return (
      <div className="flex gap-4 text-sm mt-3 text-muted-foreground">
        <span>🔍 Trovati: <strong className="text-foreground">{summary.totalFound as number}</strong></span>
        <span>✅ Salvati: <strong className="text-foreground">{summary.created as number}</strong></span>
        <span>⏭ Già presenti: <strong className="text-foreground">{summary.skipped as number}</strong></span>
      </div>
    );
  }

  // FULL_DISCOVERY summary
  if ("totalCreated" in summary) {
    const crawl = summary.crawl as Record<string, number> | null;
    const search = summary.search as Record<string, number> | null;
    return (
      <div className="space-y-1.5 mt-3">
        {crawl && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground w-24">Crawl:</span>
            <span>Scansionate: <strong className="text-foreground">{crawl.crawledCount}</strong></span>
            <span>Salvate: <strong className="text-foreground">{crawl.created}</strong></span>
          </div>
        )}
        {search && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground w-24">Ricerca:</span>
            <span>Trovati: <strong className="text-foreground">{search.totalFound}</strong></span>
            <span>Salvati: <strong className="text-foreground">{search.created}</strong></span>
          </div>
        )}
        <p className="text-sm font-medium pt-1">
          Totale nuovi contenuti: {summary.totalCreated as number}
        </p>
      </div>
    );
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(["PENDING", "RUNNING"]);

export function DiscoveryJobStatus({
  projectId,
  initialJob,
}: {
  projectId: string;
  initialJob: SerializedDiscoveryJob | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);

  // Poll while job is active
  useEffect(() => {
    if (!job || !ACTIVE_STATUSES.has(job.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/discovery/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.data) {
          setJob(data.data);
          if (!ACTIVE_STATUSES.has(data.data.status)) {
            clearInterval(interval);
            router.refresh(); // refresh page data (history, discovered items)
          }
        }
      } catch {
        // ignore transient fetch errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [job?.status, projectId, router]);

  if (!job) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nessun job avviato. Clicca su{" "}
        <span className="font-medium text-foreground">Avvia Discovery</span> per iniziare.
      </div>
    );
  }

  const status = STATUS_CONFIG[job.status] ?? STATUS_CONFIG["PENDING"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
          </CardTitle>
          <Badge variant={status.variant} className="flex items-center gap-1.5">
            {status.icon}
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div className="text-muted-foreground">Avviato</div>
          <div>{formatDate(job.startedAt ?? job.createdAt)}</div>
          {job.completedAt && (
            <>
              <div className="text-muted-foreground">Completato</div>
              <div>{formatDate(job.completedAt)}</div>
            </>
          )}
        </div>

        {ACTIVE_STATUSES.has(job.status) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Aggiornamento automatico ogni 3 secondi…
          </div>
        )}

        {job.resultSummary && <ResultSummary summary={job.resultSummary} />}

        {job.status === "FAILED" && job.errorMessage && (
          <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
            {job.errorMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
