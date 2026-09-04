import {
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applySimNodes,
  createGraphSim,
  fitGraphCamera,
  type GraphCamera,
  type GraphSim,
  graphCameraScale,
  graphEdgeGeom,
  graphSimAwake,
  graphWorldTransform,
  graphZoomFactor,
  heatGraphSim,
  indexKnowledgeGraph,
  type KnowledgeGraphNode,
  knowledgeGraphFocusIds,
  layoutKnowledgeGraph,
  panGraphCamera,
  pickGraphLabels,
  pinGraphNode,
  setGraphSimTarget,
  stepGraphSim,
  unpinGraphNode,
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
  onSelect: (path: string | null) => void;
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
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const sizeObserver = useRef<ResizeObserver | null>(null);
  const wheelCleanup = useRef<(() => void) | null>(null);
  const zoomIdle = useRef(0);
  const cameraRef = useRef<GraphCamera>({
    x: 0,
    y: 0,
    w: EMPTY_VIEW.width,
    h: EMPTY_VIEW.height,
  });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const simRef = useRef<GraphSim | null>(null);
  const rafRef = useRef(0);
  const reduceMotion = useRef(false);
  const canvasDrag = useRef<{
    pointer: number;
    x: number;
    y: number;
    origin: GraphCamera;
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

  const kickSim = useCallback(() => {
    if (rafRef.current || reduceMotion.current) return;
    const loop = () => {
      const sim = simRef.current;
      const dragging = Boolean(nodeDrag.current);
      if (!sim) {
        rafRef.current = 0;
        return;
      }
      const ticks = dragging ? 3 : 2;
      for (let i = 0; i < ticks; i++) stepGraphSim(sim);
      setNodes((current) => applySimNodes(sim, current));
      if (!dragging && !graphSimAwake(sim)) {
        rafRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const applyCamera = useCallback(
    (next: GraphCamera, zoomMode: "idle" | "now" | "hold" = "idle") => {
      cameraRef.current = next;
      const vp = viewportRef.current;
      worldRef.current?.setAttribute(
        "transform",
        graphWorldTransform(next, vp),
      );
      if (zoomMode === "hold") return;
      if (zoomIdle.current) window.clearTimeout(zoomIdle.current);
      zoomIdle.current = 0;
      if (zoomMode === "now") {
        const k = graphCameraScale(next, vp);
        setZoom((current) => (Math.abs(current - k) < 0.01 ? current : k));
        return;
      }
      zoomIdle.current = window.setTimeout(() => {
        zoomIdle.current = 0;
        const k = graphCameraScale(cameraRef.current, viewportRef.current);
        setZoom((current) => (Math.abs(current - k) < 0.01 ? current : k));
      }, 80);
    },
    [],
  );

  useEffect(() => {
    reduceMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    simRef.current = createGraphSim(layout.nodes, layout.edges);
    setNodes(layout.nodes);
    kickSim();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [kickSim, layout]);

  const attachSvg = useCallback((node: SVGSVGElement | null) => {
    sizeObserver.current?.disconnect();
    sizeObserver.current = null;
    wheelCleanup.current?.();
    wheelCleanup.current = null;
    svgRef.current = node;
    if (!node) return;
    const measure = () => {
      const width = Math.round(node.clientWidth);
      const height = Math.round(node.clientHeight);
      if (width < 8 || height < 8) return;
      setViewport((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    sizeObserver.current = observer;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const screen = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const vp = viewportRef.current;
      const camera = cameraRef.current;
      applyCamera(
        zoomGraphCamera(
          camera,
          worldFromScreen(camera, screen, vp),
          graphZoomFactor(event.deltaY),
          vp,
        ),
      );
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    wheelCleanup.current = () => node.removeEventListener("wheel", onWheel);
  }, [applyCamera]);

  const visible = useMemo(
    () => (showIsolates ? nodes : nodes.filter((node) => !node.isolate)),
    [nodes, showIsolates],
  );

  useEffect(() => {
    const fitted = showIsolates
      ? layout.nodes
      : layout.nodes.filter((node) => !node.isolate);
    applyCamera(fitGraphCamera(fitted, viewport), "now");
  }, [applyCamera, layout, showIsolates, viewport]);

  const byId = useMemo(
    () => new Map(visible.map((node) => [node.id, node])),
    [visible],
  );
  const linked = useMemo(
    () => knowledgeGraphFocusIds(index, hover, props.selected),
    [hover, index, props.selected],
  );
  const focusing = linked.size > 0;
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
    const ids = new Set<number>(linked);
    if (ids.size > 16) {
      ids.clear();
      const selectedId = props.selected
        ? index.byPath.get(props.selected)
        : undefined;
      const hoverId = hover ? index.byPath.get(hover) : undefined;
      if (selectedId != null) ids.add(selectedId);
      if (hoverId != null) ids.add(hoverId);
    }
    return ids;
  }, [hover, index, linked, props.selected]);
  const labeled = useMemo(() => {
    const candidates = focusing
      ? visible.filter(
          (node) => linked.has(node.id) || alwaysLabels.has(node.id),
        )
      : visible;
    if (zoom < 0.42) return alwaysLabels;
    return pickGraphLabels(candidates, alwaysLabels, 52, zoom);
  }, [alwaysLabels, focusing, linked, visible, zoom]);
  const status =
    hover ||
    props.selected ||
    (visible.length === 0
      ? isolateCount > 0
        ? "No links yet"
        : "Empty map"
      : `${visible.length} notes`);

  useEffect(() => {
    return () => {
      if (zoomIdle.current) window.clearTimeout(zoomIdle.current);
    };
  }, []);

  if (
    layout.nodes.length === 0 ||
    (visible.length === 0 && isolateCount === 0)
  ) {
    return (
      <div className="knowledge-empty">
        <p>No links yet. Notes that mention each other show up here.</p>
      </div>
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
              className="knowledge-graph-toggle"
              type="button"
              aria-pressed={showIsolates}
              onClick={() => setShowIsolates((open) => !open)}
            >
              Isolates
            </button>
          ) : null}
          <button
            className="knowledge-graph-toggle"
            type="button"
            onClick={() =>
              applyCamera(fitGraphCamera(visible, viewport), "now")
            }
          >
            Fit
          </button>
        </div>
      </div>
      <div className="knowledge-graph-canvas">
        {visible.length === 0 ? (
          <div className="knowledge-empty">
            <p>Notes aren’t linked yet. Turn on Isolates to see unlinked files.</p>
          </div>
        ) : null}
        <svg
          ref={attachSvg}
          className={cn(panning && "panning")}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label="Office knowledge links. Scroll to zoom, drag to pan. Click a note to focus it. Double-click opens it."
          onPointerDown={(event) => {
            if (event.button !== 0 || nodeDrag.current) return;
            canvasDrag.current = {
              pointer: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              origin: cameraRef.current,
              moved: false,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const camera = cameraRef.current;
            const pin = nodeDrag.current;
            if (pin && pin.pointer === event.pointerId) {
              const dx =
                ((event.clientX - pin.x) * camera.w) /
                Math.max(1, viewportRef.current.width);
              const dy =
                ((event.clientY - pin.y) * camera.h) /
                Math.max(1, viewportRef.current.height);
              if (Math.abs(dx) + Math.abs(dy) > 2) pin.moved = true;
              const sim = simRef.current;
              if (sim) {
                pinGraphNode(sim, pin.id, pin.origX + dx, pin.origY + dy);
                if (reduceMotion.current) {
                  setNodes((current) => applySimNodes(sim, current));
                } else {
                  if (pin.moved) setGraphSimTarget(sim, 0.42);
                  kickSim();
                }
              } else {
                setNodes((current) =>
                  current.map((node) =>
                    node.id === pin.id
                      ? { ...node, x: pin.origX + dx, y: pin.origY + dy }
                      : node,
                  ),
                );
              }
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
              applyCamera(
                panGraphCamera(start.origin, dx, dy, viewportRef.current),
                "hold",
              );
            }
          }}
          onPointerUp={(event) => {
            const pin = nodeDrag.current;
            if (pin?.pointer === event.pointerId) {
              const sim = simRef.current;
              if (sim) {
                unpinGraphNode(sim, pin.id);
                setGraphSimTarget(sim, 0);
                if (pin.moved) {
                  heatGraphSim(sim, 0.22);
                  kickSim();
                }
              }
              nodeDrag.current = null;
            }
            if (canvasDrag.current?.pointer === event.pointerId) {
              if (!canvasDrag.current.moved) props.onSelect(null);
              canvasDrag.current = null;
              setPanning(false);
            }
          }}
        >
          <g
            ref={worldRef}
            className="knowledge-graph-world"
            transform={graphWorldTransform(cameraRef.current, viewport)}
          >
          {layout.edges.map((edge) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            const hot = linked.has(edge.from) && linked.has(edge.to);
            const faded = focusing && !hot;
            const geom = graphEdgeGeom(from, to);
            return (
              <g
                key={`${edge.from}-${edge.to}`}
                className={cn(
                  "knowledge-graph-edge",
                  hot && "linked",
                  faded && "faded",
                )}
              >
                <path className="knowledge-graph-edge-glow" d={geom.d} />
                <path className="knowledge-graph-edge-core" d={geom.d} />
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
                const sim = simRef.current;
                if (sim) pinGraphNode(sim, node.id, node.x, node.y);
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
            <li key={name} style={{ "--graph-hue": hue } as CSSProperties}>
              <span className="knowledge-graph-swatch" />
              {name}
            </li>
          ))}
        </ul>
      ) : null}
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
  const hue = {
    "--graph-hue": props.node.hue,
  } as CSSProperties;
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
      style={hue}
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
      <circle
        className="knowledge-graph-hit"
        r={Math.max(11, props.node.r + 7)}
      />
      <circle className="knowledge-graph-glow" r={props.node.r + 6} />
      <circle className="knowledge-graph-dot" r={props.node.r} />
      {props.labeled ? (
        <text y={props.node.r + 12} textAnchor="middle">
          {props.node.label}
        </text>
      ) : null}
    </g>
  );
}
