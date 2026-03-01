"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Plus, Minus, X } from "lucide-react";
import type { ForceGraphMethods } from "react-force-graph-2d";

// canvas-force-graph (underlying lib) exposes refresh() at runtime
// but the TS types don't include it yet
type GraphRef = ForceGraphMethods & { refresh?: () => void };

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
  BRAND:        "#3b82f6",
  PERSON:       "#a855f7",
  ORGANIZATION: "#6366f1",
  PRODUCT:      "#22c55e",
  LOCATION:     "#f97316",
  CONCEPT:      "#64748b",
  TOPIC:        "#ec4899",
  OTHER:        "#94a3b8",
};

// Stable callbacks that don't depend on component state
const NODE_CANVAS_OBJECT_MODE = () => "replace" as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LINK_WIDTH = (link: any) => Math.max(0.5, Math.min((link.weight ?? 1) * 0.5, 4));
const LINK_COLOR = () => "#cbd5e1";

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphCanvas({ nodes, edges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphRef>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Refs for canvas drawing — changing these never causes a React re-render,
  // which means ForceGraph2D never sees prop changes → simulation stays frozen
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const relatedIdsRef = useRef<Set<string>>(new Set());

  // HTML overlay states (only affect DOM outside the canvas)
  const [tooltip, setTooltip] = useState<GraphNode | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<{
    node: GraphNode;
    related: GraphNode[];
  } | null>(null);

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

  // ── Stable graphData ──────────────────────────────────────────────────────
  // CRITICAL: must be memoized. A new object reference on every render causes
  // ForceGraph2D to call d3ReheatSimulation → nodes start moving again.
  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n })),
      links: edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // intentionally empty: data never changes after mount
  );

  // ── Canvas drawing ────────────────────────────────────────────────────────

  const maxFreq = useMemo(
    () => Math.max(...nodes.map((n) => n.frequency), 1),
    [nodes]
  );

  const nodeCanvasObject = useCallback(
    (node: GraphNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D) => {
      const isHovered = hoveredIdRef.current === node.id;
      const isSelected = selectedIdRef.current === node.id;
      const isRelated = relatedIdsRef.current.has(node.id);
      const hasSelection = selectedIdRef.current !== null;

      const r = 4 + (node.frequency / maxFreq) * 12;
      const color = TYPE_COLORS[node.type] ?? TYPE_COLORS.OTHER;

      ctx.globalAlpha = hasSelection && !isSelected && !isRelated ? 0.2 : 1;

      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, isSelected ? r * 1.3 : r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, r * 1.3 + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (nodes.length < 60 || isHovered || isSelected) {
        ctx.globalAlpha = hasSelection && !isSelected && !isRelated ? 0.2 : 1;
        ctx.font = `${isHovered || isSelected ? "bold " : ""}10px Inter, sans-serif`;
        ctx.fillStyle = "#1e293b";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.label, node.x ?? 0, (node.y ?? 0) + r + 9);
      }

      ctx.globalAlpha = 1;
    },
    [maxFreq, nodes.length] // eslint-disable-line react-hooks/exhaustive-deps
    // hoveredIdRef/selectedIdRef/relatedIdsRef are refs — stable, read fresh each frame
  );

  // ── Event handlers (memoized to keep ForceGraph2D props stable) ───────────

  const handleEngineStop = useCallback(() => {
    graphRef.current?.pauseAnimation();
  }, []);

  const handleNodeHover = useCallback((node: object | null) => {
    const n = node as GraphNode | null;
    hoveredIdRef.current = n?.id ?? null;
    graphRef.current?.refresh?.();
    setTooltip(n);
  }, []);

  const handleNodeClick = useCallback((node: object) => {
    const n = node as GraphNode;

    if (selectedIdRef.current === n.id) {
      selectedIdRef.current = null;
      relatedIdsRef.current = new Set();
      graphRef.current?.refresh?.();
      setSelectedPanel(null);
      return;
    }

    const connectedIds = new Set<string>();
    for (const e of edges) {
      const src = typeof e.source === "object" ? (e.source as GraphNode).id : e.source;
      const tgt = typeof e.target === "object" ? (e.target as GraphNode).id : e.target;
      if (src === n.id) connectedIds.add(tgt);
      else if (tgt === n.id) connectedIds.add(src);
    }

    selectedIdRef.current = n.id;
    relatedIdsRef.current = connectedIds;
    graphRef.current?.refresh?.();
    setSelectedPanel({ node: n, related: nodes.filter((nd) => connectedIds.has(nd.id)) });
  }, [edges, nodes]);

  const clearSelection = useCallback(() => {
    selectedIdRef.current = null;
    relatedIdsRef.current = new Set();
    graphRef.current?.refresh?.();
    setSelectedPanel(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">
          Nessuna entità trovata. Avvia l&apos;analisi sul progetto per popolare il grafo.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <ForceGraph2D
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={graphRef as any}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeId="id"
        nodeCanvasObject={nodeCanvasObject as never}
        nodeCanvasObjectMode={NODE_CANVAS_OBJECT_MODE}
        linkWidth={LINK_WIDTH}
        linkColor={LINK_COLOR}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        onEngineStop={handleEngineStop}
        cooldownTicks={150}
        d3AlphaDecay={0.05}
        enableNodeDrag
        enableZoomInteraction
        backgroundColor="transparent"
      />

      {/* ── Zoom controls ── */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 bg-background/90 backdrop-blur-sm"
          onClick={() => graphRef.current?.zoom(1.3, 400)}
          title="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 bg-background/90 backdrop-blur-sm"
          onClick={() => graphRef.current?.zoom(0.77, 400)}
          title="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Legend ── */}
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

      {/* ── Hover tooltip ── */}
      {tooltip && !selectedPanel && (
        <div className="absolute bottom-4 left-4 bg-background/95 border rounded-lg px-3 py-2 text-xs shadow-md pointer-events-none">
          <p className="font-semibold">{tooltip.label}</p>
          <p className="text-muted-foreground">
            {tooltip.type.toLowerCase()} · {tooltip.frequency} occorrenz{tooltip.frequency === 1 ? "a" : "e"}
          </p>
          <p className="text-muted-foreground mt-0.5 italic">Clicca per vedere i correlati</p>
        </div>
      )}

      {/* ── Selected node panel ── */}
      {selectedPanel && (
        <div className="absolute bottom-4 left-4 bg-background/95 border rounded-lg shadow-md w-56 text-xs">
          <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2 border-b">
            <div className="min-w-0">
              <p className="font-semibold truncate">{selectedPanel.node.label}</p>
              <p className="text-muted-foreground mt-0.5">
                {selectedPanel.node.type.toLowerCase()} · {selectedPanel.node.frequency} occorrenz{selectedPanel.node.frequency === 1 ? "a" : "e"}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 shrink-0 -mt-0.5 -mr-1"
              onClick={clearSelection}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="px-3 py-2.5">
            {selectedPanel.related.length === 0 ? (
              <p className="text-muted-foreground italic">Nessun nodo correlato</p>
            ) : (
              <>
                <p className="font-medium mb-1.5">
                  Correlati ({selectedPanel.related.length})
                </p>
                <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                  {selectedPanel.related.map((n) => (
                    <li key={n.id} className="flex items-center gap-1.5 text-muted-foreground truncate">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: TYPE_COLORS[n.type] ?? TYPE_COLORS.OTHER }}
                      />
                      {n.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
