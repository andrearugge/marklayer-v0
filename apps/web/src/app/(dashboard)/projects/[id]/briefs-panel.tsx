"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown, ChevronUp, Loader2, FileText,
  Check, X, CircleCheck, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { BriefStatus, SourcePlatform } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BriefItem {
  id: string;
  title: string;
  platform: SourcePlatform;
  gapType: string;
  gapLabel: string;
  keyPoints: string[];
  entities: string[];
  targetWordCount: number | null;
  notes: string | null;
  status: BriefStatus;
  generatedAt: string;
  createdAt: string;
}

interface Props {
  projectId: string;
  initialBriefs: BriefItem[];
  initialTotal: number;
  activeStatus: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const GAP_TYPE_STYLES: Record<string, { label: string; color: string }> = {
  PLATFORM:  { label: "Piattaforma", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  TOPIC:     { label: "Topic",       color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  ENTITY:    { label: "Entità",      color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  FRESHNESS: { label: "Freschezza",  color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
};

const STATUS_CONFIG: Record<BriefStatus, { label: string; color: string }> = {
  PENDING:  { label: "Da fare",   color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  ACCEPTED: { label: "Accettato", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  REJECTED: { label: "Scartato",  color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  DONE:     { label: "Fatto",     color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

// ─── Single brief card ────────────────────────────────────────────────────────

function BriefCard({
  brief,
  projectId,
  onStatusChange,
  onDelete,
}: {
  brief: BriefItem;
  projectId: string;
  onStatusChange: (id: string, status: BriefStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  const gapStyle = GAP_TYPE_STYLES[brief.gapType] ?? { label: brief.gapType, color: "bg-gray-100 text-gray-700" };
  const statusCfg = STATUS_CONFIG[brief.status];

  async function updateStatus(status: BriefStatus) {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/briefs/${brief.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onStatusChange(brief.id, status);
      } else {
        toast.error("Errore nell'aggiornamento del brief.");
      }
    });
  }

  async function deleteBrief() {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/briefs/${brief.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDelete(brief.id);
        toast.success("Brief eliminato.");
      } else {
        toast.error("Errore nell'eliminazione del brief.");
      }
    });
  }

  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${gapStyle.color}`}>
                {gapStyle.label}
              </span>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {brief.platform}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
              {brief.targetWordCount && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {brief.targetWordCount} parole
                </span>
              )}
            </div>

            {/* Title */}
            <p className="font-semibold text-sm leading-snug">{brief.title}</p>

            {/* Gap label */}
            <p className="text-xs text-muted-foreground">Gap: {brief.gapLabel}</p>
          </div>

          {/* Expand toggle */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0 space-y-4">
          {/* Key points */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Punti chiave</p>
            <ol className="space-y-1 list-decimal list-inside">
              {(brief.keyPoints as string[]).map((kp, i) => (
                <li key={i} className="text-sm text-foreground">{kp}</li>
              ))}
            </ol>
          </div>

          {/* Entities */}
          {(brief.entities as string[]).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Entità da menzionare</p>
              <div className="flex flex-wrap gap-1.5">
                {(brief.entities as string[]).map((e, i) => (
                  <span key={i} className="inline-flex items-center rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 px-2 py-0.5 text-xs font-medium">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {brief.notes && (
            <p className="text-xs text-muted-foreground italic border-l-2 pl-3">{brief.notes}</p>
          )}
        </CardContent>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-4 pb-3 flex-wrap">
        {brief.status !== "ACCEPTED" && brief.status !== "DONE" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => updateStatus("ACCEPTED")}
            disabled={pending}
          >
            <Check className="h-3 w-3" />
            Accetta
          </Button>
        )}
        {brief.status !== "REJECTED" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={() => updateStatus("REJECTED")}
            disabled={pending}
          >
            <X className="h-3 w-3" />
            Scarta
          </Button>
        )}
        {brief.status === "ACCEPTED" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/20"
            onClick={() => updateStatus("DONE")}
            disabled={pending}
          >
            <CircleCheck className="h-3 w-3" />
            Fatto
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1 text-muted-foreground ml-auto"
          onClick={deleteBrief}
          disabled={pending}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </Button>
      </div>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BriefsPanel({ projectId, initialBriefs, initialTotal, activeStatus }: Props) {
  const router = useRouter();
  const [briefs, setBriefs] = useState<BriefItem[]>(initialBriefs);

  function handleStatusChange(id: string, status: BriefStatus) {
    setBriefs((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    router.refresh();
  }

  function handleDelete(id: string) {
    setBriefs((prev) => prev.filter((b) => b.id !== id));
    router.refresh();
  }

  if (briefs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <FileText className="mb-4 h-10 w-10 text-muted-foreground/40" />
        <h3 className="mb-1 text-base font-semibold">Nessun brief</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {activeStatus === "PENDING,ACCEPTED"
            ? "Clicca \"Genera Brief\" per creare i brief basati sui gap del tuo contenuto."
            : "Nessun brief con questo filtro."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{initialTotal} brief trovati</p>
      {briefs.map((brief) => (
        <BriefCard
          key={brief.id}
          brief={brief}
          projectId={projectId}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
