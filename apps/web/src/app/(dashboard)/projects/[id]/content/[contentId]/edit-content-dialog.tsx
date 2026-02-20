"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { SourcePlatform, ContentType } from "@prisma/client";
import {
  EditContentFormSchema,
  type EditContentFormData,
} from "@/lib/validations/content";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const PLATFORM_OPTIONS: { value: SourcePlatform; label: string }[] = [
  { value: "WEBSITE", label: "Website" },
  { value: "SUBSTACK", label: "Substack" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "REDDIT", label: "Reddit" },
  { value: "QUORA", label: "Quora" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "TWITTER", label: "Twitter / X" },
  { value: "NEWS", label: "News" },
  { value: "OTHER", label: "Altro" },
];

const TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: "ARTICLE", label: "Articolo" },
  { value: "BLOG_POST", label: "Blog Post" },
  { value: "PAGE", label: "Pagina" },
  { value: "SOCIAL_POST", label: "Post Social" },
  { value: "COMMENT", label: "Commento" },
  { value: "MENTION", label: "Menzione" },
  { value: "VIDEO", label: "Video" },
  { value: "PODCAST", label: "Podcast" },
  { value: "OTHER", label: "Altro" },
];

type ItemFields = {
  id: string;
  projectId: string;
  title: string;
  url: string | null;
  sourcePlatform: SourcePlatform;
  contentType: ContentType;
  rawContent: string | null;
  publishedAt: string | null; // pre-formatted as YYYY-MM-DD
};

export function EditContentDialog({ item }: { item: ItemFields }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const defaultValues: EditContentFormData = {
    title: item.title,
    url: item.url ?? "",
    sourcePlatform: item.sourcePlatform,
    contentType: item.contentType,
    rawContent: item.rawContent ?? "",
    publishedAt: item.publishedAt ?? "",
  };

  const form = useForm<EditContentFormData>({
    resolver: zodResolver(EditContentFormSchema),
    defaultValues,
  });

  async function onSubmit(values: EditContentFormData) {
    setIsLoading(true);
    const res = await fetch(
      `/api/projects/${item.projectId}/content/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }
    );
    const data = await res.json();
    setIsLoading(false);

    if (!res.ok) {
      toast.error(data.error?.message ?? "Errore nell'aggiornamento.");
      return;
    }

    toast.success("Contenuto aggiornato.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) form.reset(defaultValues);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Modifica
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica contenuto</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titolo *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="sourcePlatform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Piattaforma</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PLATFORM_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="publishedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data di pubblicazione</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rawContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contenuto</FormLabel>
                  <FormControl>
                    <Textarea rows={6} {...field} />
                  </FormControl>
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
