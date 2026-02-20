"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { UpdateProjectSchema, type UpdateProjectData } from "@/lib/validations/project";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProjectFields = {
  id: string;
  name: string;
  description: string | null;
  domain: string | null;
};

export function EditProjectDialog({ project }: { project: ProjectFields }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UpdateProjectData>({
    resolver: zodResolver(UpdateProjectSchema),
    defaultValues: {
      name: project.name,
      description: project.description ?? "",
      domain: project.domain ?? "",
    },
  });

  async function onSubmit(values: UpdateProjectData) {
    setIsLoading(true);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    setIsLoading(false);

    if (!res.ok) {
      toast.error(data.error?.message ?? "Errore nell'aggiornamento del progetto.");
      return;
    }

    toast.success("Progetto aggiornato.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          form.reset({
            name: project.name,
            description: project.description ?? "",
            domain: project.domain ?? "",
          });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Modifica
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifica progetto</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dominio</FormLabel>
                  <FormControl>
                    <Input placeholder="example.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Il sito web principale del brand (opzionale).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvataggio..." : "Salva modifiche"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
