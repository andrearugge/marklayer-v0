"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
  hasActiveBriefsJob: boolean;
}

export function GenerateBriefsButton({ projectId, hasActiveBriefsJob }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/briefs/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Errore durante l'avvio.");
        return;
      }
      toast.success("Generazione brief avviata.");
      router.refresh();
    } catch {
      toast.error("Servizio non raggiungibile.");
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || hasActiveBriefsJob;

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleGenerate}
      disabled={isDisabled}
      className="gap-1.5"
    >
      {isDisabled ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Wand2 className="h-3.5 w-3.5" />
      )}
      {hasActiveBriefsJob ? "Generazione in corso…" : "Genera Brief"}
    </Button>
  );
}
