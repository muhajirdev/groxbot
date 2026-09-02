import { useMemo, useRef, useState } from "react";
import {
  indexKnowledgeGraph,
  knowledgeGraphLinkedIds,
  layoutKnowledgeGraph,
} from "../lib/knowledge-graph";
import { cn } from "../ui";

export function KnowledgeGraphMap(props: {
  paths: string[];
  out: number[][];
  selected: string | null;
  files: ReadonlySet<string>;
  onSelect: (path: string) => void;
  onOpen: (path: string) => void;
}) {
  const index = useMemo(
    () => indexKnowledgeGraph({ paths: props.paths, out: props.out }),
    [props.paths, props.out],
  );
  const layout = useMemo(
    () => layoutKnowledgeGraph({ paths: props.paths, out: props.out }),
    [props.paths, props.out],
  );
  const byId = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout],
  );
  const linked = useMemo(
    () =>
      props.selected
        ? knowledgeGraphLinkedIds(index, props.selected)
        : new Set<number>(),
    [index, props.selected],
  );
  const [pan, setPan] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (layout.nodes.length === 0) {
    return (
      <p className="explorer-empty knowledge-hint">
        No links yet. Notes that mention each other show up here.
      </p>
    );
  }

  return (
    <div className="knowledge-graph">
      <svg
        ref={svgRef}
        className={drag.current ? "panning" : undefined}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        aria-label="Office knowledge links"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          drag.current = {
            pointer: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            panX: pan.x,
            panY: pan.y,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.pointer !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true;
          if (start.moved) {
            setPan({
              x: start.panX + dx,
              y: start.panY + dy,
              k: pan.k,
            });
          }
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointer === event.pointerId) drag.current = null;
        }}
        onWheel={(event) => {
          event.preventDefault();
          const next = Math.min(2.4, Math.max(0.45, pan.k * (event.deltaY > 0 ? 0.92 : 1.08)));
          setPan((current) => ({ ...current, k: next }));
        }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.k})`}>
          {layout.edges.map((edge) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            const hot = linked.has(edge.from) && linked.has(edge.to);
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                className={cn("knowledge-graph-edge", hot && "linked")}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
              />
            );
          })}
          {layout.nodes.map((node) => (
            <GraphNode
              key={node.path}
              node={node}
              selected={node.path === props.selected}
              linked={linked.has(node.id)}
              missing={!props.files.has(node.path)}
              onSelect={() => {
                if (drag.current?.moved) return;
                props.onSelect(node.path);
              }}
              onOpen={() => {
                if (drag.current?.moved) return;
                props.onOpen(node.path);
              }}
            />
          ))}
        </g>
      </svg>
      <p className="knowledge-graph-hint">
        Drag to pan. Double-click a note to open it.
      </p>
    </div>
  );
}

function GraphNode(props: {
  node: { path: string; x: number; y: number; label: string };
  selected: boolean;
  linked: boolean;
  missing: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: SVG graph node
    <g
      className={cn(
        "knowledge-graph-node",
        props.selected && "selected",
        props.linked && "linked",
        props.missing && "missing",
      )}
      transform={`translate(${props.node.x} ${props.node.y})`}
      onClick={(event) => {
        event.stopPropagation();
        props.onSelect();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        props.onOpen();
      }}
    >
      <title>{props.node.path}</title>
      <circle r={14} />
      <text y={28} textAnchor="middle">
        {props.node.label}
      </text>
    </g>
  );
}
