"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// react-force-graph-2d is browser-only — dynamic import with ssr:false
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      Caricamento grafo…
    </div>
  ),
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  frequency: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Color map by entity type ─────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  BRAND:        "#3b82f6", // blue
  PERSON:       "#a855f7", // purple
  ORGANIZATION: "#6366f1", // indigo
  PRODUCT:      "#22c55e", // green
  LOCATION:     "#f97316", // orange
  CONCEPT:      "#64748b", // slate
  TOPIC:        "#ec4899", // pink
  OTHER:        "#94a3b8", // gray
};

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphCanvas({ nodes, edges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hovered, setHovered] = useState<GraphNode | null>(null);

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Max frequency for node size scaling
  const maxFreq = Math.max(...nodes.map((n) => n.frequency), 1);

  const nodeCanvasObject = useCallback(
    (node: GraphNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D) => {
      const r = 4 + (node.frequency / maxFreq) * 12;
      const color = TYPE_COLORS[node.type] ?? TYPE_COLORS.OTHER;

      // Circle
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Label (only if zoomed in or small graph)
      if (nodes.length < 60 || hovered?.id === node.id) {
        ctx.font = `${hovered?.id === node.id ? "bold " : ""}10px Inter, sans-serif`;
        ctx.fillStyle = "#1e293b";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.label, node.x ?? 0, (node.y ?? 0) + r + 8);
      }
    },
    [maxFreq, nodes.length, hovered]
  );

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">
          Nessuna entità trovata. Avvia l&apos;analisi sul progetto per popolare il grafo.
        </p>
      </div>
    );
  }

  // Build ForceGraph data — it mutates nodes in place so we clone
  const graphData = {
    nodes: nodes.map((n) => ({ ...n })),
    links: edges.map((e) => ({ ...e, source: e.source, target: e.target })),
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <ForceGraph2D
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeId="id"
        nodeLabel="label"
        nodeCanvasObject={nodeCanvasObject as never}
        nodeCanvasObjectMode={() => "replace"}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkWidth={(link: any) => Math.max(0.5, Math.min((link.weight ?? 1) * 0.5, 4))}
        linkColor={() => "#cbd5e1"}
        onNodeHover={(node) => setHovered(node as GraphNode | null)}
        cooldownTicks={100}
        enableNodeDrag
        enableZoomInteraction
        backgroundColor="transparent"
      />

      {/* Legend */}
      <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm border rounded-lg p-3 text-xs space-y-1.5">
        {Object.entries(TYPE_COLORS)
          .filter(([type]) => nodes.some((n) => n.type === type))
          .map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground capitalize">{type.toLowerCase()}</span>
            </div>
          ))}
      </div>

      {/* Hovered node tooltip */}
      {hovered && (
        <div className="absolute bottom-3 left-3 bg-background/95 border rounded-lg px-3 py-2 text-xs shadow-md">
          <p className="font-semibold">{hovered.label}</p>
          <p className="text-muted-foreground">
            {hovered.type.toLowerCase()} · {hovered.frequency} occorrenz{hovered.frequency === 1 ? "a" : "e"}
          </p>
        </div>
      )}
    </div>
  );
}
