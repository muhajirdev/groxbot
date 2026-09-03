import {
  type PresentNode,
  presentPreview,
  safePresentImageSrc,
} from "@groxbot/contracts";

export function presentFilePlace(place: unknown): "computer" | "knowledge" {
  return place === "knowledge" ? "knowledge" : "computer";
}

export function presentFileTitle(node: PresentNode): string {
  if (typeof node.title === "string" && node.title.trim()) {
    return node.title.trim();
  }
  return presentPreview(node);
}

export function presentFileOpen(
  botId: string,
  path: string,
  place: unknown,
):
  | { screen: "Computer"; botId: string; path: string }
  | { screen: "Knowledge"; path: string } {
  if (presentFilePlace(place) === "knowledge") {
    return { screen: "Knowledge", path };
  }
  return { screen: "Computer", botId, path };
}

export function presentImageSrc(src: unknown): string | null {
  return typeof src === "string" ? safePresentImageSrc(src) : null;
}

export function presentNodeText(node: PresentNode): string {
  return String(node.text ?? node.value ?? node.label ?? "");
}

export function presentTable(node: PresentNode): {
  columns: string[];
  rows: string[][];
} {
  const columns = Array.isArray(node.columns)
    ? node.columns.map((column) => {
        if (
          column &&
          typeof column === "object" &&
          "label" in column &&
          typeof column.label === "string"
        ) {
          return column.label;
        }
        return typeof column === "string" ? column : "";
      })
    : [];
  const rows = Array.isArray(node.rows)
    ? node.rows.map((row) =>
        Array.isArray(row)
          ? row.map((cell) =>
              cell == null || typeof cell === "object" ? "" : String(cell),
            )
          : [],
      )
    : [];
  return { columns, rows };
}

export type PresentChartPoint = { label: string; value: number };

export function presentChart(node: PresentNode): {
  variant: "bar" | "line" | "sparkline" | "area";
  points: PresentChartPoint[];
} {
  const variant =
    node.variant === "line" ||
    node.variant === "sparkline" ||
    node.variant === "area"
      ? node.variant
      : "bar";
  const series = Array.isArray(node.series) ? node.series : [];
  const first =
    series[0] && typeof series[0] === "object" && "data" in series[0]
      ? series[0].data
      : node.data;
  const raw = Array.isArray(first) ? first : [];
  const points = raw.map((point, index) => {
    const row =
      point && typeof point === "object"
        ? (point as { label?: unknown; value?: unknown })
        : {};
    const value =
      typeof row.value === "number" && Number.isFinite(row.value)
        ? Math.max(0, row.value)
        : 0;
    const label =
      typeof row.label === "string" && row.label.trim()
        ? row.label.trim()
        : String(index + 1);
    return { label, value };
  });
  return { variant, points };
}
