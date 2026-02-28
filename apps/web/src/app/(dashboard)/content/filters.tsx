"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORM_LABELS, TYPE_LABELS, STATUS_LABELS } from "@/lib/content-labels";
import type { SourcePlatform, ContentType, ContentStatus } from "@prisma/client";

interface Project {
  id: string;
  name: string;
}

interface Props {
  projects: Project[];
}

const PLATFORMS: SourcePlatform[] = [
  "WEBSITE", "SUBSTACK", "MEDIUM", "LINKEDIN",
  "REDDIT", "YOUTUBE", "TWITTER", "NEWS", "QUORA", "OTHER",
];

const TYPES: ContentType[] = [
  "ARTICLE", "BLOG_POST", "PAGE", "SOCIAL_POST",
  "COMMENT", "MENTION", "VIDEO", "PODCAST", "OTHER",
];

const STATUSES: ContentStatus[] = ["DISCOVERED", "APPROVED", "REJECTED", "ARCHIVED"];

export function GlobalContentFilters({ projects }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string | undefined) => {
      const next = new URLSearchParams(params.toString());
      if (value && value !== "ALL") {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      next.delete("page"); // reset pagination on filter change
      startTransition(() => router.push(`/content?${next.toString()}`));
    },
    [params, router]
  );

  return (
    <div className="flex flex-wrap gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 w-52"
          placeholder="Cerca per titolo…"
          defaultValue={params.get("search") ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            const next = new URLSearchParams(params.toString());
            if (v) next.set("search", v); else next.delete("search");
            next.delete("page");
            startTransition(() => router.push(`/content?${next.toString()}`));
          }}
        />
      </div>

      {/* Project */}
      <Select
        value={params.get("projectId") ?? "ALL"}
        onValueChange={(v) => update("projectId", v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Tutti i progetti" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Tutti i progetti</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status */}
      <Select
        value={params.get("status") ?? "ALL"}
        onValueChange={(v) => update("status", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Tutti gli status</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Platform */}
      <Select
        value={params.get("sourcePlatform") ?? "ALL"}
        onValueChange={(v) => update("sourcePlatform", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Piattaforma" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Tutte</SelectItem>
          {PLATFORMS.map((p) => (
            <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Type */}
      <Select
        value={params.get("contentType") ?? "ALL"}
        onValueChange={(v) => update("contentType", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Tutti i tipi</SelectItem>
          {TYPES.map((t) => (
            <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
