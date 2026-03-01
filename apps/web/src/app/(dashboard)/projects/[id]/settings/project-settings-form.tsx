"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { UpdateProjectSchema, type UpdateProjectData } from "@/lib/validations/project";
import { Button } from "@/components/ui/button";
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

export function ProjectSettingsForm({ project }: { project: ProjectFields }) {
  const router = useRouter();
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
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Errore nell'aggiornamento del progetto.");
        return;
      }
      toast.success("Impostazioni salvate.");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrizione</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvataggio…" : "Salva modifiche"}
          </Button>
          {form.formState.isDirty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                form.reset({
                  name: project.name,
                  description: project.description ?? "",
                  domain: project.domain ?? "",
                })
              }
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Annulla
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
