import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fitGraphCamera,
  type GraphCamera,
  graphEdgeGeom,
  indexKnowledgeGraph,
  type KnowledgeGraphNode,
  knowledgeGraphLinkedIds,
  layoutKnowledgeGraph,
  panGraphCamera,
  pickGraphLabels,
  worldFromScreen,
  zoomGraphCamera,
} from "../lib/knowledge-graph";
import { cn } from "../ui";

const EMPTY_VIEW = { width: 720, height: 480 };

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
  const [showIsolates, setShowIsolates] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [viewport, setViewport] = useState(EMPTY_VIEW);
  const [camera, setCamera] = useState<GraphCamera>({ x: 0, y: 0, k: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const sizeObserver = useRef<ResizeObserver | null>(null);
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

  useEffect(() => {
    setNodes(layout.nodes);
  }, [layout]);

  const attachSvg = useCallback((node: SVGSVGElement | null) => {
    sizeObserver.current?.disconnect();
    sizeObserver.current = null;
    svgRef.current = node;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      setViewport((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    sizeObserver.current = observer;
  }, []);

  const visible = useMemo(
    () => (showIsolates ? nodes : nodes.filter((node) => !node.isolate)),
    [nodes, showIsolates],
  );

  useEffect(() => {
    const fitted = showIsolates
      ? layout.nodes
      : layout.nodes.filter((node) => !node.isolate);
    setCamera(fitGraphCamera(fitted, viewport));
  }, [layout, showIsolates, viewport]);

  const byId = useMemo(
    () => new Map(visible.map((node) => [node.id, node])),
    [visible],
  );
  const linked = useMemo(
    () =>
      props.selected
        ? knowledgeGraphLinkedIds(index, props.selected)
        : new Set<number>(),
    [index, props.selected],
  );
  const focusing = Boolean(props.selected && byId.size > 0 && linked.size > 0);
  const isolateCount = layout.nodes.filter((node) => node.isolate).length;
  const folders = useMemo(() => {
    const seen = new Map<string, number>();
    for (const node of visible) {
      const name = node.folder || "root";
      if (!seen.has(name)) seen.set(name, node.hue);
    }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);
  const alwaysLabels = useMemo(() => {
    const ids = new Set<number>();
    const selectedId = props.selected
      ? index.byPath.get(props.selected)
      : undefined;
    const hoverId = hover ? index.byPath.get(hover) : undefined;
    if (selectedId != null) ids.add(selectedId);
    if (hoverId != null) ids.add(hoverId);
    if (focusing) {
      for (const id of linked) ids.add(id);
    }
    return ids;
  }, [focusing, hover, index, linked, props.selected]);
  const labeled = useMemo(() => {
    if (camera.k < 0.48) return alwaysLabels;
    return pickGraphLabels(visible, alwaysLabels);
  }, [alwaysLabels, camera.k, visible]);
  const status =
    hover ||
    props.selected ||
    (visible.length === 0
      ? isolateCount > 0
        ? "No links yet"
        : "Empty map"
      : `${visible.length} notes`);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const screen = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const world = worldFromScreen(camera, screen);
      const next = camera.k * (event.deltaY > 0 ? 0.9 : 1.11);
      setCamera(zoomGraphCamera(camera, world, next));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [camera]);

  if (
    layout.nodes.length === 0 ||
    (visible.length === 0 && isolateCount === 0)
  ) {
    return (
      <p className="explorer-empty knowledge-hint">
        No links yet. Notes that mention each other show up here.
      </p>
    );
  }

  return (
    <div className="knowledge-graph">
      <div className="knowledge-graph-toolbar">
        <p className="knowledge-graph-status" title={status}>
          {status}
        </p>
        <div className="knowledge-graph-tools">
          {isolateCount > 0 ? (
            <button
              className="btn ghost tiny"
              type="button"
              aria-pressed={showIsolates}
              onClick={() => setShowIsolates((open) => !open)}
            >
              Isolates
            </button>
          ) : null}
          <button
            className="btn ghost tiny"
            type="button"
            onClick={() => setCamera(fitGraphCamera(visible, viewport))}
          >
            Fit
          </button>
        </div>
      </div>
      <div className="knowledge-graph-canvas">
        {visible.length === 0 ? (
          <p className="explorer-empty knowledge-hint">
            Notes aren’t linked yet. Turn on Isolates to see unlinked files.
          </p>
        ) : null}
        <svg
          ref={attachSvg}
          className={panning ? "panning" : undefined}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label="Office knowledge links"
          onPointerDown={(event) => {
            if (event.button !== 0 || nodeDrag.current) return;
            canvasDrag.current = {
              pointer: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              panX: camera.x,
              panY: camera.y,
              moved: false,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const pin = nodeDrag.current;
            if (pin && pin.pointer === event.pointerId) {
              const dx = (event.clientX - pin.x) / camera.k;
              const dy = (event.clientY - pin.y) / camera.k;
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
              setCamera(
                panGraphCamera(
                  { ...camera, x: start.panX, y: start.panY },
                  dx,
                  dy,
                ),
              );
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
        >
          <g
            transform={`translate(${camera.x} ${camera.y}) scale(${camera.k})`}
          >
            {layout.edges.map((edge) => {
              const from = byId.get(edge.from);
              const to = byId.get(edge.to);
              if (!from || !to) return null;
              const hot = linked.has(edge.from) && linked.has(edge.to);
              const faded = focusing && !hot;
              const geom = graphEdgeGeom(from, to, edge.reciprocal);
              return (
                <g
                  key={`${edge.from}-${edge.to}`}
                  className={cn(
                    "knowledge-graph-edge",
                    hot && "linked",
                    faded && "faded",
                  )}
                >
                  <path d={geom.d} />
                  <polygon
                    className="knowledge-graph-arrow"
                    transform={`translate(${geom.ax} ${geom.ay}) rotate(${geom.angle})`}
                    points="0,-3.1 8,0 0,3.1"
                  />
                </g>
              );
            })}
            {visible.map((node) => (
              <GraphNode
                key={node.path}
                node={node}
                selected={node.path === props.selected}
                linked={linked.has(node.id)}
                faded={focusing && !linked.has(node.id)}
                labeled={labeled.has(node.id)}
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
                  if (nodeDrag.current?.moved || canvasDrag.current?.moved)
                    return;
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
      </div>
      {folders.length > 1 ? (
        <ul className="knowledge-graph-legend">
          {folders.map(([name, hue]) => (
            <li key={name}>
              <span
                className="knowledge-graph-swatch"
                style={{ background: `hsl(${hue} 46% 54%)` }}
              />
              {name}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="knowledge-graph-hint">
        Scroll to zoom, drag to pan. Double-click opens a note.
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
  const fill = props.selected
    ? undefined
    : `hsl(${props.node.hue} ${props.linked ? 52 : 42}% ${props.linked ? 62 : 54}%)`;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: SVG graph node
    <g
      className={cn(
        "knowledge-graph-node",
        props.selected && "selected",
        props.linked && "linked",
        props.faded && "faded",
        props.missing && "missing",
        props.node.isolate && "isolate",
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
        <circle className="knowledge-graph-glow" r={props.node.r + 10} />
      ) : null}
      <circle
        r={props.selected ? props.node.r + 1.8 : props.node.r}
        style={fill ? { fill } : undefined}
      />
      {props.labeled ? (
        <text y={props.node.r + 13} textAnchor="middle">
          {props.node.label}
        </text>
      ) : null}
    </g>
  );
}
