"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ImportResult = {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

const CSV_TEMPLATE = `url,title,sourcePlatform,contentType,publishedAt
https://example.com/article,Il mio articolo,WEBSITE,ARTICLE,2024-01-15
https://sub.substack.com/p/post,Newsletter n.1,SUBSTACK,ARTICLE,2024-02-01
,Post su LinkedIn senza URL,LINKEDIN,SOCIAL_POST,`;

const PLATFORM_VALUES =
  "WEBSITE · SUBSTACK · MEDIUM · LINKEDIN · REDDIT · QUORA · YOUTUBE · TWITTER · NEWS · OTHER";
const TYPE_VALUES =
  "ARTICLE · BLOG_POST · PAGE · SOCIAL_POST · COMMENT · MENTION · VIDEO · PODCAST · OTHER";

export function CsvImportDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
  }

  function handleReset() {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose(open: boolean) {
    setOpen(open);
    if (!open) {
      handleReset();
    }
  }

  async function handleSubmit() {
    if (!file) return;
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/projects/${projectId}/content/import`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setIsLoading(false);

    if (!res.ok) {
      toast.error(data.error?.message ?? "Errore durante l'importazione.");
      return;
    }

    setResult(data.data as ImportResult);

    if (data.data.imported > 0) {
      toast.success(
        `${data.data.imported} contenut${data.data.imported === 1 ? "o" : "i"} importat${data.data.imported === 1 ? "o" : "i"}.`
      );
      router.refresh();
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_import.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-3.5 w-3.5" />
          Importa CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importa contenuti da CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format description */}
          <div className="rounded-md bg-muted/50 p-3 space-y-2 text-xs">
            <p className="font-medium text-sm">Formato atteso</p>
            <p className="text-muted-foreground">
              Header richiesto:{" "}
              <code className="font-mono">
                url, title, sourcePlatform, contentType, publishedAt
              </code>
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium">sourcePlatform:</span> {PLATFORM_VALUES}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium">contentType:</span> {TYPE_VALUES}
            </p>
            <p className="text-muted-foreground">
              Campi opzionali: <code className="font-mono">url</code>,{" "}
              <code className="font-mono">publishedAt</code> (formato YYYY-MM-DD).
              Massimo 1.000 righe, 5 MB.
            </p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={downloadTemplate}
            >
              Scarica template CSV
            </Button>
          </div>

          {/* File input */}
          {!result ? (
            <div className="space-y-3">
              <label
                htmlFor="csv-file"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-8 cursor-pointer hover:border-muted-foreground/50 transition-colors"
              >
                {file ? (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground">
                      ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <Upload className="h-8 w-8 opacity-40" />
                    <span>Clicca per selezionare un file CSV</span>
                  </div>
                )}
                <input
                  id="csv-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isLoading}
                >
                  Annulla
                </Button>
                <Button onClick={handleSubmit} disabled={!file || isLoading}>
                  {isLoading ? "Importazione..." : "Importa"}
                </Button>
              </div>
            </div>
          ) : (
            /* Results */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {result.imported}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500">Importati</p>
                </div>
                <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 p-3">
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                    {result.skipped}
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-500">
                    Saltati
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {result.errors.length}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-500">Errori</p>
                </div>
              </div>

              {result.skipped > 0 && (
                <p className="text-xs text-muted-foreground">
                  I contenuti saltati erano già presenti nel progetto (stesso URL).
                </p>
              )}

              {result.errors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-xs font-medium text-destructive mb-2">
                    Righe con errori:
                  </p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      <span className="font-mono font-medium">Riga {e.row}:</span>{" "}
                      {e.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleReset}>
                  Importa altro
                </Button>
                <Button onClick={() => setOpen(false)}>Chiudi</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
