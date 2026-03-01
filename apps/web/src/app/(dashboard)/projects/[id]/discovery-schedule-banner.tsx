import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiscoveryScheduleProps {
  frequency: string;
  nextRunAt: Date;
  lastRunAt: Date | null;
  projectId: string;
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Settimanale",
  monthly: "Mensile",
  quarterly: "Trimestrale",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DiscoveryScheduleBanner({
  frequency,
  nextRunAt,
  lastRunAt,
  projectId,
}: DiscoveryScheduleProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm dark:border-blue-900/50 dark:bg-blue-950/20">
      <div className="flex items-center gap-2.5 text-blue-700 dark:text-blue-400">
        <CalendarClock className="h-4 w-4 shrink-0" />
        <span>
          <span className="font-medium">Discovery automatica attiva</span>
          {" — "}
          Cadenza: {FREQUENCY_LABELS[frequency] ?? frequency}
          {" · "}
          Prossima: <span className="font-medium">{formatDate(nextRunAt)}</span>
          {" · "}
          Ultima: <span className="font-medium">{formatDate(lastRunAt)}</span>
        </span>
      </div>
      <Button asChild variant="ghost" size="sm" className="shrink-0 h-7 px-2 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30">
        <Link href={`/projects/${projectId}/content/discovery`}>
          Configura
        </Link>
      </Button>
    </div>
  );
}
