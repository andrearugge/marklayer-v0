"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FetchResult {
  total: number;
  fetched: number;
  errors: number;
}

export function FetchContentButton({
  projectId,
  unfetchedCount,
}: {
  projectId: string;
  unfetchedCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);

  if (unfetchedCount === 0) return null;

  async function handleFetch() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/content/fetch`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Errore nell'estrazione del contenuto.");
        return;
      }
      const r = data.data as FetchResult;
      setResult(r);
      toast.success(`Estratti ${r.fetched} contenuti su ${r.total}.`);
      router.refresh();
    } catch {
      toast.error("Servizio non raggiungibile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        onClick={handleFetch}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            Estrazione in corso…
          </>
        ) : (
          <>
            <Download className="mr-2 h-3.5 w-3.5" />
            Estrai contenuto
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({unfetchedCount})
            </span>
          </>
        )}
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground">
          ✓ {result.fetched} estratti
          {result.errors > 0 && `, ${result.errors} errori`}
        </span>
      )}
    </div>
  );
}
