import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  indexKnowledgeGraph,
  knowledgeGraphLinkedIds,
  layoutKnowledgeGraph,
  type KnowledgeGraphNode,
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
  const [nodes, setNodes] = useState(layout.nodes);
  useEffect(() => {
    setNodes(layout.nodes);
  }, [layout]);
  const byId = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const linked = useMemo(
    () =>
      props.selected
        ? knowledgeGraphLinkedIds(index, props.selected)
        : new Set<number>(),
    [index, props.selected],
  );
  const focusing = Boolean(props.selected);
  const [hover, setHover] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0, k: 1 });
  const canvasDrag = useRef<{
    pointer: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const nodeDrag = useRef<{
    pointer: number;
    id: number;
    x: number;
    y: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

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
        className={panning ? "panning" : undefined}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        aria-label="Office knowledge links"
        onPointerDown={(event) => {
          if (event.button !== 0 || nodeDrag.current) return;
          canvasDrag.current = {
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
          const pin = nodeDrag.current;
          if (pin && pin.pointer === event.pointerId) {
            const dx = (event.clientX - pin.x) / pan.k;
            const dy = (event.clientY - pin.y) / pan.k;
            if (Math.abs(dx) + Math.abs(dy) > 2) pin.moved = true;
            setNodes((current) =>
              current.map((node) =>
                node.id === pin.id
                  ? { ...node, x: pin.origX + dx, y: pin.origY + dy }
                  : node,
              ),
            );
            return;
          }
          const start = canvasDrag.current;
          if (!start || start.pointer !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) {
            start.moved = true;
            setPanning(true);
          }
          if (start.moved) {
            setPan({ x: start.panX + dx, y: start.panY + dy, k: pan.k });
          }
        }}
        onPointerUp={(event) => {
          if (nodeDrag.current?.pointer === event.pointerId) {
            nodeDrag.current = null;
          }
          if (canvasDrag.current?.pointer === event.pointerId) {
            canvasDrag.current = null;
            setPanning(false);
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          const next = Math.min(
            2.8,
            Math.max(0.35, pan.k * (event.deltaY > 0 ? 0.9 : 1.1)),
          );
          setPan((current) => ({ ...current, k: next }));
        }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.k})`}>
          {layout.edges.map((edge) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            const hot = linked.has(edge.from) && linked.has(edge.to);
            const faded = focusing && !hot;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                className={cn(
                  "knowledge-graph-edge",
                  hot && "linked",
                  faded && "faded",
                )}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
              />
            );
          })}
          {nodes.map((node) => (
            <GraphNode
              key={node.path}
              node={node}
              selected={node.path === props.selected}
              linked={linked.has(node.id)}
              faded={focusing && !linked.has(node.id)}
              labeled={
                node.path === props.selected ||
                node.path === hover ||
                linked.has(node.id)
              }
              missing={!props.files.has(node.path)}
              onHover={setHover}
              onPointerDown={(event) => {
                event.stopPropagation();
                nodeDrag.current = {
                  pointer: event.pointerId,
                  id: node.id,
                  x: event.clientX,
                  y: event.clientY,
                  origX: node.x,
                  origY: node.y,
                  moved: false,
                };
              }}
              onSelect={() => {
                if (nodeDrag.current?.moved || canvasDrag.current?.moved) return;
                props.onSelect(node.path);
              }}
              onOpen={() => {
                if (nodeDrag.current?.moved) return;
                props.onOpen(node.path);
              }}
            />
          ))}
        </g>
      </svg>
      <p className="knowledge-graph-hint">
        Drag a note to pin it. Double-click to open.
      </p>
    </div>
  );
}

function GraphNode(props: {
  node: KnowledgeGraphNode;
  selected: boolean;
  linked: boolean;
  faded: boolean;
  labeled: boolean;
  missing: boolean;
  onHover: (path: string | null) => void;
  onPointerDown: (event: PointerEvent) => void;
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
        props.faded && "faded",
        props.missing && "missing",
      )}
      transform={`translate(${props.node.x} ${props.node.y})`}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
        props.onPointerDown(event);
      }}
      onPointerEnter={() => props.onHover(props.node.path)}
      onPointerLeave={() => props.onHover(null)}
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
      {props.selected ? (
        <circle className="knowledge-graph-glow" r={props.node.r + 8} />
      ) : null}
      <circle r={props.selected ? props.node.r + 1.6 : props.node.r} />
      {props.labeled ? (
        <text y={props.node.r + 12} textAnchor="middle">
          {props.node.label}
        </text>
      ) : null}
    </g>
  );
}
