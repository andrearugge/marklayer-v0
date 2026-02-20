"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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

export function DeleteContentButton({
  projectId,
  contentId,
  contentTitle,
}: {
  projectId: string;
  contentId: string;
  contentTitle: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleDelete() {
    setIsLoading(true);
    const res = await fetch(`/api/projects/${projectId}/content/${contentId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setIsLoading(false);

    if (!res.ok) {
      toast.error(data.error?.message ?? "Errore durante l'eliminazione.");
      return;
    }

    toast.success("Contenuto eliminato.");
    router.push(`/projects/${projectId}`);
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading}>
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Elimina
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Elimina contenuto</AlertDialogTitle>
          <AlertDialogDescription>
            Vuoi eliminare definitivamente{" "}
            <strong>&ldquo;{contentTitle}&rdquo;</strong>? Questa operazione non
            può essere annullata.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Eliminazione..." : "Elimina"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
