import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GraphCanvas } from "./graph-canvas";
import type { GraphNode, GraphEdge } from "./graph-canvas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NetworkIcon } from "lucide-react";

// ─── Co-occurrence edge query ─────────────────────────────────────────────────

interface CoOccurrenceRow {
  source_id: string;
  target_id: string;
  weight: bigint;
}

// ─── Project selector — Client wrapper ───────────────────────────────────────

// We need a Client Component just for the Select onChange navigation.
// Keep it tiny — defined inline in the page file via a separate file import
// to avoid making the whole page a Client Component.

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = await searchParams;

  // Fetch user projects for the selector
  const userProjects = await prisma.project.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Determine selected project
  let projectId = raw.projectId ?? "";
  if (!projectId && userProjects.length > 0) {
    // Default to first project — redirect so URL is canonical
    redirect(`/graph?projectId=${userProjects[0]!.id}`);
  }

  // Validate projectId belongs to this user
  const selectedProject = userProjects.find((p) => p.id === projectId) ?? null;
  if (!selectedProject && userProjects.length > 0) {
    redirect(`/graph?projectId=${userProjects[0]!.id}`);
  }

  // Fetch entities and co-occurrence edges (only if project is selected)
  let nodes: GraphNode[] = [];
  let edges: GraphEdge[] = [];

  if (selectedProject) {
    const [rawEntities, coOccurrenceRows] = await Promise.all([
      // Top 80 entities by frequency (exclude TOPIC — those are clusters, not individual entities)
      prisma.entity.findMany({
        where: { projectId, type: { not: "TOPIC" } },
        orderBy: { frequency: "desc" },
        take: 80,
        select: { id: true, label: true, type: true, frequency: true },
      }),

      // Co-occurrence edges: pairs of entities in the same content item
      prisma.$queryRawUnsafe<CoOccurrenceRow[]>(
        `SELECT
           a.entity_id AS source_id,
           b.entity_id AS target_id,
           COUNT(*)    AS weight
         FROM content_entities a
         JOIN content_entities b
           ON a.content_id = b.content_id
          AND a.entity_id < b.entity_id
         JOIN content_items ci ON a.content_id = ci.id
         WHERE ci.project_id = $1
         GROUP BY a.entity_id, b.entity_id
         HAVING COUNT(*) >= 1
         ORDER BY weight DESC
         LIMIT 300`,
        projectId
      ),
    ]);

    const nodeIds = new Set(rawEntities.map((e) => e.id));

    nodes = rawEntities.map((e) => ({
      id: e.id,
      label: e.label,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: e.type as any,
      frequency: e.frequency,
    }));

    edges = coOccurrenceRows
      .filter((r) => nodeIds.has(r.source_id) && nodeIds.has(r.target_id))
      .map((r) => ({
        source: r.source_id,
        target: r.target_id,
        weight: Number(r.weight),
      }));
  }

  const entityCount = nodes.length;
  const edgeCount = edges.length;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <NetworkIcon className="h-6 w-6" />
            Knowledge Graph
          </h1>
          <p className="text-muted-foreground text-sm">
            {selectedProject
              ? `${entityCount} entit${entityCount === 1 ? "à" : "à"} · ${edgeCount} connession${edgeCount === 1 ? "e" : "i"} (co-occorrenza)`
              : "Seleziona un progetto per visualizzare il grafo."}
          </p>
        </div>

        {/* Project selector */}
        {userProjects.length > 0 ? (
          <ProjectSelector projects={userProjects} current={projectId} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nessun progetto.{" "}
            <Link href="/projects" className="underline underline-offset-4">
              Creane uno →
            </Link>
          </p>
        )}
      </div>

      {/* Graph canvas */}
      {userProjects.length === 0 ? (
        <div className="flex-1 rounded-lg border border-dashed flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Crea un progetto e avvia l'analisi per vedere il knowledge graph.
          </p>
        </div>
      ) : (
        <div className="flex-1 rounded-lg border overflow-hidden bg-muted/10">
          <GraphCanvas nodes={nodes} edges={edges} />
        </div>
      )}
    </div>
  );
}

// ─── Project selector (Client Component) ─────────────────────────────────────

// Inline import to keep file simpler — imported from a separate file
import { ProjectSelector } from "./project-selector";
