"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  if (!job) return null;

  const label = JOB_TYPE_LABELS[job.jobType] ?? job.jobType;

  return (
    <div className="flex items-center gap-2 text-sm">
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
              <span className="ml-1 text-xs text-red-500">({job.errorMessage.slice(0, 60)})</span>
            )}
          </span>
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
