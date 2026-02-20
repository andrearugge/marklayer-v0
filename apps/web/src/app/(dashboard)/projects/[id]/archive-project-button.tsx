"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ArchiveProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleArchive() {
    setIsLoading(true);
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    const data = await res.json();
    setIsLoading(false);

    if (!res.ok) {
      toast.error(data.error?.message ?? "Errore durante l'archiviazione.");
      return;
    }

    toast.success(`Progetto "${projectName}" archiviato.`);
    router.push("/projects");
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading}>
          <Archive className="mr-2 h-3.5 w-3.5" />
          Archivia
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archivia progetto</AlertDialogTitle>
          <AlertDialogDescription>
            Vuoi archiviare il progetto <strong>&ldquo;{projectName}&rdquo;</strong>? Il
            progetto e tutti i suoi contenuti rimarranno accessibili in sola lettura,
            ma non potrai aggiungere nuovi contenuti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={handleArchive} disabled={isLoading}>
            {isLoading ? "Archiviazione..." : "Archivia"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
