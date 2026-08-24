/** In-browser formula subset used by the sheets template. Keep in sync with sheets.client.ts. */

function colName(c: number): string {
  return String.fromCharCode(65 + c);
}

function ref(r: number, c: number): string {
  return colName(c) + String(r + 1);
}

function parseRef(token: string): { c: number; r: number } | null {
  const m = /^([A-H])([1-9][0-9]?)$/i.exec(String(token).trim());
  if (!m?.[1] || !m[2]) return null;
  return { c: m[1].toUpperCase().charCodeAt(0) - 65, r: Number(m[2]) - 1 };
}

function raw(cells: Record<string, string>, cellRef: string): string {
  const v = cells[cellRef];
  return v == null ? "" : String(v);
}

function toNum(value: unknown): number {
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isError(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("#");
}

export function evalSheet(
  cells: Record<string, string>,
  cellRef: string,
  seen: Record<string, boolean> = {},
): string | number {
  if (seen[cellRef]) return "#CYCLE!";
  const nextSeen = { ...seen, [cellRef]: true };
  const value = raw(cells, cellRef);
  if (!value) return "";
  if (value.charAt(0) !== "=") return value;
  const expr = value.slice(1).trim();
  const sum = /^SUM\(([A-H][0-9]+):([A-H][0-9]+)\)$/i.exec(expr);
  if (sum?.[1] && sum[2]) {
    const a = parseRef(sum[1]);
    const b = parseRef(sum[2]);
    if (!a || !b) return "#REF!";
    let total = 0;
    for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
      for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) {
        const inner = evalSheet(cells, ref(r, c), nextSeen);
        if (isError(inner)) return inner;
        total += toNum(inner);
      }
    }
    return total;
  }
  const parts = expr.split(/([+-])/);
  let acc: number | null = null;
  let op = "+";
  for (const part of parts) {
    const token = part.trim();
    if (!token) continue;
    if (token === "+" || token === "-") {
      op = token;
      continue;
    }
    const loc = parseRef(token);
    const inner = loc
      ? evalSheet(cells, ref(loc.r, loc.c), { ...nextSeen })
      : token;
    if (isError(inner)) return inner;
    const n = toNum(inner);
    acc = acc == null ? n : op === "-" ? acc - n : acc + n;
  }
  return acc == null ? value : acc;
}
