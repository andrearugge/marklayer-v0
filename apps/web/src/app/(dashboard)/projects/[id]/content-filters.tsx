"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface ContentFiltersProps {
  initialSearch: string;
  initialPlatform: string;
  initialType: string;
  initialStatus: string;
  initialFetchStatus: string;
}

export function ContentFilters({
  initialSearch,
  initialPlatform,
  initialType,
  initialStatus,
  initialFetchStatus,
}: ContentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const createQueryString = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      return params.toString();
    },
    [searchParams]
  );

  function handleSearch(value: string) {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString({ search: value })}`);
    });
  }

  function handleSelect(key: string, value: string) {
    startTransition(() => {
      router.push(
        `${pathname}?${createQueryString({ [key]: value === "all" ? "" : value })}`
      );
    });
  }

  function handleReset() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters =
    initialSearch || initialPlatform || initialType || initialStatus || initialFetchStatus;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per titolo..."
          defaultValue={initialSearch}
          className="w-56 pl-8"
          onChange={(e) => handleSearch(e.target.value)}
          disabled={isPending}
        />
      </div>

      <Select
        defaultValue={initialPlatform || "all"}
        onValueChange={(v) => handleSelect("sourcePlatform", v)}
        disabled={isPending}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Piattaforma" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutte</SelectItem>
          <SelectItem value="WEBSITE">Website</SelectItem>
          <SelectItem value="SUBSTACK">Substack</SelectItem>
          <SelectItem value="MEDIUM">Medium</SelectItem>
          <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
          <SelectItem value="REDDIT">Reddit</SelectItem>
          <SelectItem value="QUORA">Quora</SelectItem>
          <SelectItem value="YOUTUBE">YouTube</SelectItem>
          <SelectItem value="TWITTER">Twitter / X</SelectItem>
          <SelectItem value="NEWS">News</SelectItem>
          <SelectItem value="OTHER">Altro</SelectItem>
        </SelectContent>
      </Select>

      <Select
        defaultValue={initialType || "all"}
        onValueChange={(v) => handleSelect("contentType", v)}
        disabled={isPending}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i tipi</SelectItem>
          <SelectItem value="ARTICLE">Articolo</SelectItem>
          <SelectItem value="BLOG_POST">Blog Post</SelectItem>
          <SelectItem value="PAGE">Pagina</SelectItem>
          <SelectItem value="SOCIAL_POST">Post Social</SelectItem>
          <SelectItem value="COMMENT">Commento</SelectItem>
          <SelectItem value="MENTION">Menzione</SelectItem>
          <SelectItem value="VIDEO">Video</SelectItem>
          <SelectItem value="PODCAST">Podcast</SelectItem>
          <SelectItem value="OTHER">Altro</SelectItem>
        </SelectContent>
      </Select>

      <Select
        defaultValue={initialStatus || "all"}
        onValueChange={(v) => handleSelect("status", v)}
        disabled={isPending}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli status</SelectItem>
          <SelectItem value="DISCOVERED">Trovato</SelectItem>
          <SelectItem value="APPROVED">Approvato</SelectItem>
          <SelectItem value="REJECTED">Rifiutato</SelectItem>
          <SelectItem value="ARCHIVED">Archiviato</SelectItem>
        </SelectContent>
      </Select>

      <Select
        defaultValue={initialFetchStatus || "all"}
        onValueChange={(v) => handleSelect("fetchStatus", v)}
        disabled={isPending}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Scaricamento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti</SelectItem>
          <SelectItem value="fetched">Scaricati</SelectItem>
          <SelectItem value="pending">Da scaricare</SelectItem>
          <SelectItem value="error">Con errori</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={isPending}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  );
}
