"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ContentStatus } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_LABELS: Record<ContentStatus, string> = {
  DISCOVERED: "Trovato",
  APPROVED: "Approvato",
  REJECTED: "Rifiutato",
  ARCHIVED: "Archiviato",
};

const STATUS_COLORS: Record<ContentStatus, string> = {
  DISCOVERED: "text-yellow-700 dark:text-yellow-400",
  APPROVED: "text-green-700 dark:text-green-400",
  REJECTED: "text-red-700 dark:text-red-400",
  ARCHIVED: "text-gray-500 dark:text-gray-400",
};

export function ChangeStatusSelect({
  projectId,
  contentId,
  currentStatus,
}: {
  projectId: string;
  contentId: string;
  currentStatus: ContentStatus;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleChange(newStatus: string) {
    if (newStatus === currentStatus) return;
    setIsLoading(true);
    const res = await fetch(`/api/projects/${projectId}/content/${contentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    setIsLoading(false);

    if (!res.ok) {
      toast.error(data.error?.message ?? "Errore nel cambio status.");
      return;
    }

    toast.success(`Status aggiornato: ${STATUS_LABELS[newStatus as ContentStatus]}`);
    router.refresh();
  }

  return (
    <Select value={currentStatus} onValueChange={handleChange} disabled={isLoading}>
      <SelectTrigger className="w-36 h-8 text-sm">
        <SelectValue>
          <span className={STATUS_COLORS[currentStatus]}>
            {STATUS_LABELS[currentStatus]}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(STATUS_LABELS) as ContentStatus[]).map((s) => (
          <SelectItem key={s} value={s}>
            <span className={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
