"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <h2 className="text-lg font-semibold">Si è verificato un errore</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Impossibile caricare questa pagina. Prova a ricaricare.
      </p>
      <Button variant="outline" onClick={reset}>
        Riprova
      </Button>
    </div>
  );
}
