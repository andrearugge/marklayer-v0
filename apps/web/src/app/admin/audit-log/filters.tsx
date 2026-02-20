"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface AuditFiltersProps {
  initialAction: string;
}

const ACTION_LABELS: Record<string, string> = {
  "user.created": "Registrazione",
  "user.login": "Login",
  "user.role_changed": "Cambio ruolo",
  "user.status_changed": "Cambio status",
};

export function AuditFilters({ initialAction }: AuditFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleAction(value: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      if (value && value !== "all") {
        params.set("action", value);
      } else {
        params.delete("action");
      }
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleReset() {
    startTransition(() => router.push(pathname));
  }

  return (
    <div className="flex items-center gap-3">
      <Select
        defaultValue={initialAction || "all"}
        onValueChange={handleAction}
        disabled={isPending}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Tutti gli eventi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli eventi</SelectItem>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {initialAction && (
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
