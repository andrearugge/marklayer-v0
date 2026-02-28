"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, CheckCheck, X, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PLATFORM_LABELS, TYPE_LABELS } from "@/lib/content-labels";
import type { SourcePlatform, ContentType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscoveredItem {
  id: string;
  title: string;
  url: string | null;
  sourcePlatform: SourcePlatform;
  contentType: ContentType;
  excerpt: string | null;
  createdAt: string;
}

// ─── Item card ────────────────────────────────────────────────────────────────

function DiscoveredItemCard({
  item,
  projectId,
  selected,
  onSelect,
  onAction,
}: {
  item: DiscoveredItem;
  projectId: string;
  selected: boolean;
  onSelect: () => void;
  onAction: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function handleAction(status: "APPROVED" | "REJECTED") {
    setLoading(status === "APPROVED" ? "approve" : "reject");
    await onAction(item.id, status);
    setLoading(null);
  }

  return (
    <div className="flex gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30">
      {/* Checkbox */}
      <Checkbox
        checked={selected}
        onCheckedChange={onSelect}
        className="mt-0.5 shrink-0"
      />

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug line-clamp-2">
            {item.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="text-xs">
              {PLATFORM_LABELS[item.sourcePlatform]}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {TYPE_LABELS[item.contentType]}
            </Badge>
          </div>
        </div>

        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-xs"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.url}</span>
          </a>
        )}

        {item.excerpt && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {item.excerpt}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
          onClick={() => handleAction("APPROVED")}
          disabled={loading !== null}
        >
          {loading === "approve" ? "..." : "✓ Approva"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          onClick={() => handleAction("REJECTED")}
          disabled={loading !== null}
        >
          {loading === "reject" ? "..." : "✗ Rifiuta"}
        </Button>
        <Link
          href={`/projects/${projectId}/content/${item.id}`}
          className="inline-flex h-7 items-center justify-center text-xs px-3 rounded-md border hover:bg-muted transition-colors"
        >
          Vedi
        </Link>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DiscoveryReview({
  items,
  projectId,
  totalDiscovered,
}: {
  items: DiscoveredItem[];
  projectId: string;
  totalDiscovered: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const allSelected = items.length > 0 && selected.size === items.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const handleSingleAction = useCallback(
    async (id: string, status: "APPROVED" | "REJECTED") => {
      const res = await fetch(`/api/projects/${projectId}/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error("Errore nell'aggiornamento dello status.");
        return;
      }
      toast.success(status === "APPROVED" ? "Contenuto approvato." : "Contenuto rifiutato.");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    },
    [projectId, router]
  );

  async function handleBulkAction(status: "APPROVED" | "REJECTED") {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/content/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action: status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Errore nell'azione bulk.");
        return;
      }
      toast.success(
        status === "APPROVED"
          ? `${selected.size} contenuti approvati.`
          : `${selected.size} contenuti rifiutati.`
      );
      setSelected(new Set());
      router.refresh();
    } finally {
      setBulkLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <CheckCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium">Nessun elemento da revisionare</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Avvia un discovery per trovare contenuti da approvare o rifiutare.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {selected.size} selezionati
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
              onClick={() => handleBulkAction("APPROVED")}
              disabled={bulkLoading}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Approva tutti
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                  disabled={bulkLoading}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Rifiuta tutti
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Rifiuta {selected.size} contenuti?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    I contenuti selezionati verranno segnati come rifiutati.
                    Potrai cambiare status in seguito se necessario.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleBulkAction("REJECTED")}>
                    Rifiuta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Select all row */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <CheckSquare className="h-4 w-4" />
          {allSelected ? "Deseleziona tutti" : "Seleziona tutti"}
        </button>
        {totalDiscovered > items.length && (
          <span className="ml-auto text-xs text-muted-foreground">
            Mostrati {items.length} di {totalDiscovered} —{" "}
            <Link
              href={`/projects/${projectId}?status=DISCOVERED`}
              className="underline hover:no-underline"
            >
              vedi tutti
            </Link>
          </span>
        )}
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {items.map((item) => (
          <DiscoveredItemCard
            key={item.id}
            item={item}
            projectId={projectId}
            selected={selected.has(item.id)}
            onSelect={() => toggleOne(item.id)}
            onAction={handleSingleAction}
          />
        ))}
      </div>
    </div>
  );
}
