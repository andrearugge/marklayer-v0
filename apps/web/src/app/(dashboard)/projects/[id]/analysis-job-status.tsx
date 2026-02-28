"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface SerializedAnalysisJob {
  id: string;
  jobType: string;
  status: string;
  resultSummary: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  EXTRACT_ENTITIES: "Estrazione entità",
  GENERATE_EMBEDDINGS: "Generazione embedding",
  CLUSTER_TOPICS: "Clustering topic",
  COMPUTE_SCORE: "Calcolo score",
  FULL_ANALYSIS: "Analisi completa",
};

interface Props {
  projectId: string;
  initialJob: SerializedAnalysisJob | null;
  onCompleted?: () => void;
}

export function AnalysisJobStatus({ projectId, initialJob, onCompleted }: Props) {
  const [job, setJob] = useState<SerializedAnalysisJob | null>(initialJob);
  const [restarting, setRestarting] = useState(false);

  const isActive = job?.status === "PENDING" || job?.status === "RUNNING";

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/analysis/status`);
        if (!res.ok) return;
        const data = (await res.json()) as { data: SerializedAnalysisJob | null };
        setJob(data.data);
        if (
          data.data?.status === "COMPLETED" ||
          data.data?.status === "FAILED"
        ) {
          clearInterval(interval);
          if (data.data.status === "COMPLETED") onCompleted?.();
        }
      } catch {
        // ignore network errors during polling
      }
    }, 4_000);

    return () => clearInterval(interval);
  }, [isActive, projectId, onCompleted]);

  async function handleRestart() {
    setRestarting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analysis/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Impossibile riavviare l'analisi.");
        return;
      }
      toast.success("Analisi riavviata.");
      // Start polling immediately by setting a fake PENDING job
      setJob((prev) =>
        prev
          ? { ...prev, status: "PENDING", errorMessage: null }
          : null
      );
    } catch {
      toast.error("Errore di rete. Riprova.");
    } finally {
      setRestarting(false);
    }
  }

  if (!job) return null;

  const label = JOB_TYPE_LABELS[job.jobType] ?? job.jobType;

  return (
    <div className="flex items-center gap-2 text-sm flex-wrap">
      {job.status === "PENDING" && (
        <>
          <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
          <span className="text-muted-foreground">{label} — in attesa…</span>
        </>
      )}
      {job.status === "RUNNING" && (
        <>
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
          <span className="text-muted-foreground">{label} — in esecuzione…</span>
        </>
      )}
      {job.status === "COMPLETED" && (
        <>
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-muted-foreground">{label} — completato</span>
        </>
      )}
      {job.status === "FAILED" && (
        <>
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-muted-foreground">
            {label} — fallito
            {job.errorMessage && (
              <span className="ml-1 text-xs text-red-500">
                ({job.errorMessage.slice(0, 80)})
              </span>
            )}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={handleRestart}
            disabled={restarting}
          >
            {restarting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <RotateCcw className="h-3 w-3 mr-1" />
                Riavvia
              </>
            )}
          </Button>
        </>
      )}
      {isActive && (
        <Badge variant="secondary" className="text-xs">
          live
        </Badge>
      )}
    </div>
  );
}
