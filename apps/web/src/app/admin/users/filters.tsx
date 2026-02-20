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

interface UserFiltersProps {
  initialSearch: string;
  initialRole: string;
  initialStatus: string;
}

export function UserFilters({
  initialSearch,
  initialRole,
  initialStatus,
}: UserFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const createQueryString = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page"); // reset to page 1 on filter change
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

  function handleRole(value: string) {
    startTransition(() => {
      router.push(
        `${pathname}?${createQueryString({ role: value === "all" ? "" : value })}`
      );
    });
  }

  function handleStatus(value: string) {
    startTransition(() => {
      router.push(
        `${pathname}?${createQueryString({ status: value === "all" ? "" : value })}`
      );
    });
  }

  function handleReset() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters = initialSearch || initialRole || initialStatus;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per nome o email..."
          defaultValue={initialSearch}
          className="w-64 pl-8"
          onChange={(e) => handleSearch(e.target.value)}
          disabled={isPending}
        />
      </div>

      <Select
        defaultValue={initialRole || "all"}
        onValueChange={handleRole}
        disabled={isPending}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Ruolo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i ruoli</SelectItem>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>

      <Select
        defaultValue={initialStatus || "all"}
        onValueChange={handleStatus}
        disabled={isPending}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
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
