"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FetchSingleButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleFetch() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/content/fetch`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Errore durante l'estrazione.");
        return;
      }
      const { fetched, errors } = data.data as { fetched: number; errors: number };
      if (fetched > 0) {
        toast.success("Contenuto estratto con successo.");
        router.refresh();
      } else if (errors > 0) {
        toast.error("Impossibile estrarre il contenuto da questa URL.");
      } else {
        toast.info("Nessun contenuto da estrarre.");
      }
    } catch {
      toast.error("Servizio non raggiungibile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleFetch} disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          Estrazione in corso…
        </>
      ) : (
        <>
          <Download className="mr-2 h-3.5 w-3.5" />
          Estrai contenuto
        </>
      )}
    </Button>
  );
}
