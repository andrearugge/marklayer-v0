"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
  disabled?: boolean;
  size?: "sm" | "default";
}

export function StartAnalysisButton({ projectId, disabled, size = "sm" }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analysis/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "FULL_ANALYSIS" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Impossibile avviare l'analisi.");
        return;
      }
      toast.success("Analisi AI avviata. Puoi seguire il progresso nella sezione Analisi.");
      router.refresh();
    } catch {
      toast.error("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size={size} onClick={handleClick} disabled={disabled || loading}>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <Zap className="h-3.5 w-3.5 mr-1.5" />
      )}
      {loading ? "Avvio…" : "Avvia analisi AI"}
    </Button>
  );
}
