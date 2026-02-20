import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground/30">404</p>
      <h1 className="text-2xl font-bold tracking-tight">Pagina non trovata</h1>
      <p className="text-muted-foreground">
        La pagina che cerchi non esiste o è stata spostata.
      </p>
      <Button asChild>
        <Link href="/dashboard">Torna alla dashboard</Link>
      </Button>
    </div>
  );
}
