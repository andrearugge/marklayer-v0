"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ExternalLink,
  Trash2,
  CheckCheck,
  Archive,
  ThumbsDown,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { SourcePlatform, ContentType, ContentStatus } from "@prisma/client";
import {
  PLATFORM_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/content-labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ContentRow = {
  id: string;
  title: string;
  url: string | null;
  sourcePlatform: SourcePlatform;
  contentType: ContentType;
  status: ContentStatus;
  wordCount: number | null;
  publishedAt: string | null;
  createdAt: string;
  hasRawContent: boolean;
  fetchError: string | null;
};

interface ContentTableProps {
  items: ContentRow[];
  projectId: string;
  fetchErrorCount?: number;
}

// ─── Error log dialog ──────────────────────────────────────────────────────────

function ErrorLogDialog({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const [items, setItems] = useState<{ id: string; title: string; fetchError: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch error items when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/content?fetchStatus=error&limit=100`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.items) setItems(d.data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, projectId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log errori di estrazione</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Caricamento…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nessun errore trovato.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="rounded-md border p-3 space-y-1">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all">
                  {item.fetchError}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ContentTable({ items, projectId, fetchErrorCount = 0 }: ContentTableProps) {
  const router = useRouter();
  const headerCheckboxRef = useRef<HTMLButtonElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showErrorLog, setShowErrorLog] = useState(false);

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function executeBulkAction(action: "approve" | "reject" | "archive" | "delete") {
    setIsLoading(true);
    const res = await fetch(`/api/projects/${projectId}/content/bulk`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selectedIds], action }),
    });
    const data = await res.json();
    setIsLoading(false);

    if (!res.ok) {
      toast.error(data.error?.message ?? "Errore nell'operazione bulk.");
      return;
    }

    const n = data.data.count as number;
    const actionLabels: Record<string, string> = {
      approve: "approvati",
      reject: "rifiutati",
      archive: "archiviati",
      delete: "eliminati",
    };
    toast.success(`${n} contenut${n === 1 ? "o" : "i"} ${actionLabels[action]}.`);
    setSelectedIds(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {/* ── Fetch error banner ── */}
      {fetchErrorCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm dark:border-red-900/50 dark:bg-red-950/20">
          <span className="text-red-700 dark:text-red-400">
            <AlertCircle className="inline h-3.5 w-3.5 mr-1.5 align-text-bottom" />
            {fetchErrorCount} contenut{fetchErrorCount === 1 ? "o" : "i"} con errori di estrazione.
          </span>
          <Button variant="ghost" size="sm" onClick={() => setShowErrorLog(true)}>
            Vedi log
          </Button>
        </div>
      )}

      {/* ── Bulk action toolbar ── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} selezionat{selectedIds.size === 1 ? "o" : "i"}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => executeBulkAction("approve")}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Approva
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => executeBulkAction("reject")}
            >
              <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
              Rifiuta
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => executeBulkAction("archive")}
            >
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              Archivia
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Elimina
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isLoading}
              onClick={clearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <Checkbox
                  ref={headerCheckboxRef}
                  checked={allSelected}
                  data-state={someSelected ? "indeterminate" : undefined}
                  onCheckedChange={toggleAll}
                  aria-label="Seleziona tutto"
                />
              </TableHead>
              <TableHead>Titolo</TableHead>
              <TableHead className="w-32">Piattaforma</TableHead>
              <TableHead className="w-28">Tipo</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-28">Contenuto</TableHead>
              <TableHead className="w-32 text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                data-state={selectedIds.has(item.id) ? "selected" : undefined}
                className={selectedIds.has(item.id) ? "bg-muted/30" : undefined}
              >
                <TableCell className="pl-4">
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                    aria-label={`Seleziona "${item.title}"`}
                  />
                </TableCell>

                <TableCell className="max-w-xs">
                  <div className="flex items-start gap-2">
                    <Link
                      href={`/projects/${projectId}/content/${item.id}`}
                      className="font-medium hover:text-primary transition-colors line-clamp-2 leading-snug"
                    >
                      {item.title}
                    </Link>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  {item.wordCount && (
                    <span className="text-xs text-muted-foreground">
                      {item.wordCount.toLocaleString("it-IT")} parole
                    </span>
                  )}
                </TableCell>

                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {PLATFORM_LABELS[item.sourcePlatform]}
                  </Badge>
                </TableCell>

                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {TYPE_LABELS[item.contentType]}
                  </span>
                </TableCell>

                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                </TableCell>

                {/* ── Raw content status ── */}
                <TableCell>
                  {item.hasRawContent ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Scaricato
                    </span>
                  ) : item.fetchError ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-red-500 cursor-help"
                      title={item.fetchError}
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      Errore
                    </span>
                  ) : item.url ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Da scaricare
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="text-right text-xs text-muted-foreground">
                  {new Date(
                    item.publishedAt ?? item.createdAt
                  ).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Delete confirmation dialog ── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina contenuti selezionati</AlertDialogTitle>
            <AlertDialogDescription>
              Vuoi eliminare definitivamente{" "}
              <strong>
                {selectedIds.size} contenut{selectedIds.size === 1 ? "o" : "i"}
              </strong>
              ? Questa operazione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowDeleteConfirm(false);
                executeBulkAction("delete");
              }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Error log dialog ── */}
      <ErrorLogDialog
        open={showErrorLog}
        onClose={() => setShowErrorLog(false)}
        projectId={projectId}
      />
    </div>
  );
}
