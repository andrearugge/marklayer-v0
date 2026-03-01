import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderOpen, CheckCircle2, Zap, BookOpen, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground/40 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [activeProjectCount, approvedContentCount, completedAnalysisCount, briefCount] =
    await Promise.all([
      prisma.project.count({ where: { userId: user.id, status: "ACTIVE" } }),
      prisma.contentItem.count({
        where: { status: "APPROVED", project: { userId: user.id } },
      }),
      prisma.analysisJob.count({
        where: { status: "COMPLETED", project: { userId: user.id } },
      }),
      prisma.contentBrief.count({
        where: { project: { userId: user.id } },
      }),
    ]);

  const firstName = user.name?.split(" ")[0] ?? "utente";

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Ciao, {firstName} 👋
        </h1>
        <p className="text-muted-foreground">
          Ecco un riepilogo del tuo account Visiblee.
        </p>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard
          label="Progetti attivi"
          value={activeProjectCount}
          icon={FolderOpen}
          sub={activeProjectCount === 0 ? "Creane uno →" : undefined}
        />
        <KpiCard
          label="Contenuti approvati"
          value={approvedContentCount}
          icon={CheckCircle2}
          sub="su tutti i progetti"
        />
        <KpiCard
          label="Analisi eseguite"
          value={completedAnalysisCount}
          icon={Zap}
          sub="job completati"
        />
        <KpiCard
          label="Brief generati"
          value={briefCount}
          icon={BookOpen}
          sub="in tutti i progetti"
        />
      </div>

      {/* ── Quick links ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Accesso rapido
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/projects"
            className="group flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FolderOpen className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div>
                <p className="text-sm font-medium">I miei progetti</p>
                <p className="text-xs text-muted-foreground">
                  {activeProjectCount > 0
                    ? `${activeProjectCount} progett${activeProjectCount === 1 ? "o" : "i"} attiv${activeProjectCount === 1 ? "o" : "i"}`
                    : "Nessun progetto ancora"}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/settings"
            className="group flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div>
                <p className="text-sm font-medium">Impostazioni account</p>
                <p className="text-xs text-muted-foreground">
                  Profilo e preferenze
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* ── Empty state CTA ── */}
      {activeProjectCount === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <FolderOpen className="mb-4 h-10 w-10 text-muted-foreground/40" />
          <h3 className="mb-1 text-base font-semibold">Nessun progetto ancora</h3>
          <p className="mb-4 text-sm text-muted-foreground max-w-sm">
            Crea il tuo primo progetto per iniziare ad analizzare la tua presenza digitale.
          </p>
          <Button asChild>
            <Link href="/projects">
              <FolderOpen className="h-4 w-4 mr-1.5" />
              Vai ai progetti
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
