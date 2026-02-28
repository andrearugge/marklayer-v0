"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
  onStarted?: (jobId: string) => void;
}

export function GenerateSuggestionsButton({ projectId, onStarted }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analysis/suggestions`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Impossibile avviare la generazione.");
        return;
      }
      toast.success(`Generazione suggerimenti avviata per ${data.data.eligible} contenuti.`);
      onStarted?.(data.data.jobId as string);
    } catch {
      toast.error("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={loading}>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
      )}
      {loading ? "Avvio…" : "Genera Suggerimenti (batch)"}
    </Button>
  );
}
