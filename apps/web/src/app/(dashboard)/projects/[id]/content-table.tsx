"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Trash2, CheckCheck, Archive, ThumbsDown, X } from "lucide-react";
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
};

interface ContentTableProps {
  items: ContentRow[];
  projectId: string;
}

export function ContentTable({ items, projectId }: ContentTableProps) {
  const router = useRouter();
  const headerCheckboxRef = useRef<HTMLButtonElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    </div>
  );
}
