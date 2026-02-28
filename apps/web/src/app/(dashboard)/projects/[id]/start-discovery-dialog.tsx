"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export function StartDiscoveryDialog({
  projectId,
  projectDomain,
  hasActiveJob = false,
}: {
  projectId: string;
  projectDomain?: string | null;
  hasActiveJob?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [jobType, setJobType] = useState<JobType>("FULL_DISCOVERY");
  const [brand, setBrand] = useState("");
  const [domain, setDomain] = useState(projectDomain ?? "");
  const [siteUrl, setSiteUrl] = useState(
    projectDomain
      ? projectDomain.startsWith("http")
        ? projectDomain
        : `https://${projectDomain}`
      : ""
  );
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(50);
  const [platforms, setPlatforms] = useState<string[]>([
    "SUBSTACK",
    "MEDIUM",
    "LINKEDIN",
    "REDDIT",
    "NEWS",
  ]);

  const needsSearch = jobType === "SEARCH_PLATFORM" || jobType === "FULL_DISCOVERY";
  const needsCrawl = jobType === "CRAWL_SITE" || jobType === "FULL_DISCOVERY";

  function togglePlatform(value: string) {
    setPlatforms((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  }

  function buildPayload() {
    if (jobType === "CRAWL_SITE") {
      return {
        jobType,
        config: { siteUrl, maxDepth, maxPages, rateLimit: 1.0 },
      };
    }
    if (jobType === "SEARCH_PLATFORM") {
      return {
        jobType,
        config: {
          brand,
          domain: domain || undefined,
          platforms,
          maxResultsPerPlatform: 10,
        },
      };
    }
    // FULL_DISCOVERY
    return {
      jobType,
      config: {
        brand,
        domain: domain || undefined,
        platforms,
        maxResultsPerPlatform: 10,
        crawl: siteUrl
          ? { siteUrl, maxDepth, maxPages, rateLimit: 1.0 }
          : undefined,
      },
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
    if (needsCrawl && jobType === "CRAWL_SITE" && !siteUrl.trim()) {
      toast.error("Inserisci l'URL del sito da crawlare.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/discovery/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message ?? "Errore nell'avvio del discovery.");
        return;
      }

      toast.success("Discovery avviato! Verrà eseguito in background.");
      setOpen(false);
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" disabled={hasActiveJob}>
          {hasActiveJob ? (
            <>
              <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
              Discovery in corso…
            </>
          ) : (
            <>
              <Search className="mr-2 h-3.5 w-3.5" />
              Avvia Discovery
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avvia Discovery</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Job type */}
          <div className="space-y-1.5">
            <Label htmlFor="jobType">Tipo di ricerca</Label>
            <Select
              value={jobType}
              onValueChange={(v) => setJobType(v as JobType)}
            >
              <SelectTrigger id="jobType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_DISCOVERY">
                  Full Discovery (crawl + ricerca piattaforme)
                </SelectItem>
                <SelectItem value="SEARCH_PLATFORM">
                  Ricerca piattaforme
                </SelectItem>
                <SelectItem value="CRAWL_SITE">
                  Crawl sito web
                </SelectItem>
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
                    placeholder="Nike, Mario Rossi, Visiblee..."
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="domain">
                    Dominio da escludere{" "}
                    <span className="text-muted-foreground text-xs">(opzionale)</span>
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
                          id={`platform-${opt.value}`}
                          checked={platforms.includes(opt.value)}
                          onCheckedChange={() => togglePlatform(opt.value)}
                        />
                        <label
                          htmlFor={`platform-${opt.value}`}
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
                          setMaxDepth(Math.min(5, Math.max(1, Number(e.target.value))))
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
                          setMaxPages(Math.min(200, Math.max(1, Number(e.target.value))))
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
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Avvio...
                </>
              ) : (
                "Avvia"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
