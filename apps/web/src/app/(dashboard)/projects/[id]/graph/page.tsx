import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/projects";
import { GraphCanvas } from "@/app/(dashboard)/graph/graph-canvas";
import type { GraphNode, GraphEdge } from "@/app/(dashboard)/graph/graph-canvas";
import { Network } from "lucide-react";

interface CoOccurrenceRow {
  source_id: string;
  target_id: string;
  weight: bigint;
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectGraphPage({ params }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const project = await assertProjectOwnership(id, currentUser.id);
  if (!project) notFound();

  // ── Fetch data ───────────────────────────────────────────────────────────────

  const [rawEntities, coOccurrenceRows] = await Promise.all([
    prisma.entity.findMany({
      where: { projectId: id, type: { not: "TOPIC" } },
      orderBy: { frequency: "desc" },
      take: 80,
      select: { id: true, label: true, type: true, frequency: true },
    }),
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
      id
    ),
  ]);

  const nodeIds = new Set(rawEntities.map((e) => e.id));

  const nodes: GraphNode[] = rawEntities.map((e) => ({
    id: e.id,
    label: e.label,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: e.type as any,
    frequency: e.frequency,
  }));

  const edges: GraphEdge[] = coOccurrenceRows
    .filter((r) => nodeIds.has(r.source_id) && nodeIds.has(r.target_id))
    .map((r) => ({
      source: r.source_id,
      target: r.target_id,
      weight: Number(r.weight),
    }));

  const entityCount = nodes.length;
  const edgeCount = edges.length;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Network className="h-5 w-5" />
          Knowledge Graph
        </h1>
        <p className="text-sm text-muted-foreground">
          {entityCount > 0
            ? `${entityCount} entità · ${edgeCount} connession${edgeCount === 1 ? "e" : "i"} (co-occorrenza)`
            : "Nessuna entità ancora. Avvia l'analisi AI per popolare il grafo."}
        </p>
      </div>

      {/* ── Canvas ── */}
      <div className="flex-1 rounded-lg border overflow-hidden bg-muted/10">
        {entityCount === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Avvia l&apos;analisi AI dalla sezione{" "}
              <a href={`/projects/${id}/analysis`} className="underline underline-offset-4">
                Analisi
              </a>{" "}
              per estrarre le entità e visualizzare il grafo.
            </p>
          </div>
        ) : (
          <GraphCanvas nodes={nodes} edges={edges} />
        )}
      </div>
    </div>
  );
}
