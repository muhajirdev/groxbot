import { KNOW_GRAPH } from "../lib/copy";

export function KnowGraph() {
  const byId = new Map(KNOW_GRAPH.nodes.map((node) => [node.id, node]));

  return (
    <figure className="know-graph" aria-hidden="true">
      <svg viewBox="0 0 100 80" role="presentation">
        {KNOW_GRAPH.edges.map(([fromId, toId]) => {
          const from = byId.get(fromId);
          const to = byId.get(toId);
          if (!from || !to) return null;
          return (
            <line
              key={`${fromId}-${toId}`}
              className="know-graph-edge"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />
          );
        })}
        {KNOW_GRAPH.nodes.map((node) => (
          <g
            key={node.id}
            className={
              "hot" in node && node.hot
                ? "know-graph-node hot"
                : "know-graph-node"
            }
            transform={`translate(${node.x} ${node.y})`}
          >
            <circle r={node.r + 1.6} className="know-graph-glow" />
            <circle r={node.r} className="know-graph-dot" />
            {"label" in node && node.label ? (
              <text y={node.r + 3.4}>{node.label}</text>
            ) : null}
          </g>
        ))}
      </svg>
    </figure>
  );
}
