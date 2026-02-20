"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground/30">500</p>
      <h1 className="text-2xl font-bold tracking-tight">Si è verificato un errore</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        Qualcosa è andato storto. Prova a ricaricare la pagina.
      </p>
      <Button onClick={reset}>Riprova</Button>
    </div>
  );
}
