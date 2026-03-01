"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock,
  RefreshCw,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscoverySchedule {
  id: string;
  jobType: string;
  frequency: string;
  config: Record<string, unknown>;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Settimanale",
  monthly: "Mensile",
  quarterly: "Trimestrale",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_DISCOVERY: "Full Discovery",
  SEARCH_PLATFORM: "Ricerca piattaforme",
  CRAWL_SITE: "Crawl sito",
};

const PLATFORM_OPTIONS = [
  { value: "SUBSTACK", label: "Substack" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "REDDIT", label: "Reddit" },
  { value: "QUORA", label: "Quora" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "TWITTER", label: "Twitter / X" },
  { value: "NEWS", label: "News & Giornali" },
  { value: "WEBSITE", label: "Website generici" },
] as const;

type JobType = "CRAWL_SITE" | "SEARCH_PLATFORM" | "FULL_DISCOVERY";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Schedule Dialog ──────────────────────────────────────────────────────────

function ScheduleDialog({
  projectId,
  projectDomain,
  existing,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  projectDomain?: string | null;
  existing?: DiscoverySchedule | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const existingConfig = (existing?.config ?? {}) as Record<string, unknown>;

  const [frequency, setFrequency] = useState<string>(
    existing?.frequency ?? "weekly"
  );
  const [jobType, setJobType] = useState<JobType>(
    (existing?.jobType as JobType) ?? "FULL_DISCOVERY"
  );
  const [brand, setBrand] = useState<string>(
    (existingConfig.brand as string) ?? ""
  );
  const [domain, setDomain] = useState<string>(
    (existingConfig.domain as string) ?? projectDomain ?? ""
  );
  const [siteUrl, setSiteUrl] = useState<string>(
    (existingConfig.crawl as { siteUrl?: string } | undefined)?.siteUrl ??
      (existingConfig.siteUrl as string) ??
      (projectDomain
        ? projectDomain.startsWith("http")
          ? projectDomain
          : `https://${projectDomain}`
        : "")
  );
  const [maxDepth, setMaxDepth] = useState<number>(
    (existingConfig.crawl as { maxDepth?: number } | undefined)?.maxDepth ??
      (existingConfig.maxDepth as number) ??
      2
  );
  const [maxPages, setMaxPages] = useState<number>(
    (existingConfig.crawl as { maxPages?: number } | undefined)?.maxPages ??
      (existingConfig.maxPages as number) ??
      50
  );
  const [platforms, setPlatforms] = useState<string[]>(
    (existingConfig.platforms as string[]) ?? [
      "SUBSTACK",
      "MEDIUM",
      "LINKEDIN",
      "REDDIT",
      "NEWS",
    ]
  );

  const needsSearch =
    jobType === "SEARCH_PLATFORM" || jobType === "FULL_DISCOVERY";
  const needsCrawl =
    jobType === "CRAWL_SITE" || jobType === "FULL_DISCOVERY";

  function togglePlatform(value: string) {
    setPlatforms((prev) =>
      prev.includes(value)
        ? prev.filter((p) => p !== value)
        : [...prev, value]
    );
  }

  function buildConfig(): Record<string, unknown> {
    if (jobType === "CRAWL_SITE") {
      return { siteUrl, maxDepth, maxPages, rateLimit: 1.0 };
    }
    if (jobType === "SEARCH_PLATFORM") {
      return {
        brand,
        domain: domain || undefined,
        platforms,
        maxResultsPerPlatform: 10,
      };
    }
    return {
      brand,
      domain: domain || undefined,
      platforms,
      maxResultsPerPlatform: 10,
      crawl: siteUrl ? { siteUrl, maxDepth, maxPages, rateLimit: 1.0 } : undefined,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsSearch && !brand.trim()) {
      toast.error("Inserisci il nome del brand.");
      return;
    }
    if (needsSearch && platforms.length === 0) {
      toast.error("Seleziona almeno una piattaforma.");
      return;
    }
    if (jobType === "CRAWL_SITE" && !siteUrl.trim()) {
      toast.error("Inserisci l'URL del sito da crawlare.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/discovery/schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobType,
            frequency,
            config: buildConfig(),
            enabled: true,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? "Errore nel salvataggio.");
        return;
      }
      toast.success(
        existing ? "Pianificazione aggiornata." : "Pianificazione creata."
      );
      onOpenChange(false);
      onSaved();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Modifica pianificazione" : "Configura discovery ricorrente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Frequency */}
          <div className="space-y-1.5">
            <Label htmlFor="frequency">Frequenza</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Settimanale</SelectItem>
                <SelectItem value="monthly">Mensile</SelectItem>
                <SelectItem value="quarterly">Trimestrale</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Job type */}
          <div className="space-y-1.5">
            <Label htmlFor="jobType">Tipo di discovery</Label>
            <Select
              value={jobType}
              onValueChange={(v) => setJobType(v as JobType)}
            >
              <SelectTrigger id="jobType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_DISCOVERY">
                  Full Discovery (crawl + piattaforme)
                </SelectItem>
                <SelectItem value="SEARCH_PLATFORM">
                  Ricerca piattaforme
                </SelectItem>
                <SelectItem value="CRAWL_SITE">Crawl sito web</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search fields */}
          {needsSearch && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Ricerca su piattaforme
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="brand">Nome brand / keyword *</Label>
                  <Input
                    id="brand"
                    placeholder="Nike, Mario Rossi..."
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="domain">
                    Dominio da escludere{" "}
                    <span className="text-muted-foreground text-xs">
                      (opzionale)
                    </span>
                  </Label>
                  <Input
                    id="domain"
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Piattaforme da cercare</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORM_OPTIONS.map((opt) => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`sched-platform-${opt.value}`}
                          checked={platforms.includes(opt.value)}
                          onCheckedChange={() => togglePlatform(opt.value)}
                        />
                        <label
                          htmlFor={`sched-platform-${opt.value}`}
                          className="text-sm cursor-pointer"
                        >
                          {opt.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Crawl fields */}
          {needsCrawl && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Crawl sito web{" "}
                  {jobType === "FULL_DISCOVERY" && (
                    <span className="text-xs">(opzionale)</span>
                  )}
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="siteUrl">
                    URL sito{" "}
                    {jobType === "CRAWL_SITE" && (
                      <span className="text-muted-foreground">*</span>
                    )}
                  </Label>
                  <Input
                    id="siteUrl"
                    type="url"
                    placeholder="https://example.com"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    required={jobType === "CRAWL_SITE"}
                  />
                </div>
                {siteUrl && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="maxDepth">
                        Profondità max{" "}
                        <span className="text-muted-foreground">(1–5)</span>
                      </Label>
                      <Input
                        id="maxDepth"
                        type="number"
                        min={1}
                        max={5}
                        value={maxDepth}
                        onChange={(e) =>
                          setMaxDepth(
                            Math.min(5, Math.max(1, Number(e.target.value)))
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="maxPages">
                        Pagine max{" "}
                        <span className="text-muted-foreground">(1–200)</span>
                      </Label>
                      <Input
                        id="maxPages"
                        type="number"
                        min={1}
                        max={200}
                        value={maxPages}
                        onChange={(e) =>
                          setMaxPages(
                            Math.min(200, Math.max(1, Number(e.target.value)))
                          )
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                "Salva pianificazione"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────

export function DiscoveryScheduleCard({
  projectId,
  projectDomain,
}: {
  projectId: string;
  projectDomain?: string | null;
}) {
  const router = useRouter();
  const [schedule, setSchedule] = useState<DiscoverySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/discovery/schedule`
      );
      if (!res.ok) return;
      const data = await res.json();
      setSchedule(data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  async function handleToggle(enabled: boolean) {
    if (!schedule) return;
    setToggling(true);
    try {
      await fetch(`/api/projects/${projectId}/discovery/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      setSchedule((s) => (s ? { ...s, enabled } : s));
      router.refresh();
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/projects/${projectId}/discovery/schedule`, {
        method: "DELETE",
      });
      setSchedule(null);
      toast.success("Pianificazione rimossa.");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            Discovery ricorrente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-12 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" />
              Discovery ricorrente
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Esegui automaticamente la discovery su base periodica
            </CardDescription>
          </div>
          {schedule ? (
            <div className="flex items-center gap-2">
              <Switch
                checked={schedule.enabled}
                onCheckedChange={handleToggle}
                disabled={toggling}
                aria-label="Abilita/disabilita pianificazione"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setDialogOpen(true)}
                title="Modifica"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
                title="Rimuovi pianificazione"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Configura
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {schedule ? (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {FREQUENCY_LABELS[schedule.frequency] ?? schedule.frequency}
                </Badge>
                <Badge variant="outline">
                  {JOB_TYPE_LABELS[schedule.jobType] ?? schedule.jobType}
                </Badge>
                {!schedule.enabled && (
                  <Badge variant="outline" className="text-muted-foreground">
                    In pausa
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Prossima esecuzione:{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(schedule.nextRunAt)}
                  </span>
                </span>
                <span>
                  Ultima esecuzione:{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(schedule.lastRunAt)}
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nessuna pianificazione attiva. Configura una discovery automatica
              per mantenere i contenuti aggiornati.
            </p>
          )}
        </CardContent>
      </Card>

      <ScheduleDialog
        projectId={projectId}
        projectDomain={projectDomain}
        existing={schedule}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          fetchSchedule();
          router.refresh();
        }}
      />
    </>
  );
}
