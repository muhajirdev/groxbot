/** Glanceable UI the model composes in office chat (`present`). */

export const PRESENT_TOOL_NAME = "present";

export const PRESENT_TYPES = [
  "Alert",
  "Badge",
  "Box",
  "Button",
  "Caption",
  "Card",
  "Carousel",
  "Chart",
  "Checkbox",
  "Col",
  "DatePicker",
  "Divider",
  "Fact",
  "File",
  "Form",
  "Header",
  "Icon",
  "Image",
  "Input",
  "ListView",
  "ListViewItem",
  "Markdown",
  "RadioGroup",
  "Row",
  "Select",
  "Spacer",
  "Table",
  "Text",
] as const;

export type PresentType = (typeof PRESENT_TYPES)[number];

const TYPE_SET = new Set<string>(PRESENT_TYPES);

export const PRESENT_MAX_DEPTH = 8;
export const PRESENT_MAX_NODES = 80;

export const PRESENT_TOOL_DESCRIPTION = [
  "Show a glanceable UI in this thread. Args are one JSON tree: `$type` names a component, other keys are props, `children` is an array of objects — never a stringified JSON array.",
  `Allowed $type: ${PRESENT_TYPES.join(", ")}.`,
  'Example: { "$type": "Card", "title": "Q3", "children": [{ "$type": "Fact", "label": "Bookings", "value": "$1.2M" }] }.',
  'After you save a file, present File: { "$type": "File", "path": "notes/q3.md", "place": "computer" } or place "knowledge" for the office library. Image src is an http(s) URL only.',
  "Use this for facts, a short table, a chart, a saved file, or a choice. Put long notes and drafts in a file on this computer. Keep the chat reply to one short line.",
].join(" ");

export type PresentOk = {
  ok: true;
  $type: string;
  preview: string;
};

export type PresentErr = { ok: false; message: string };

export type PresentResult = PresentOk | PresentErr;

export function runPresent(input: unknown): PresentResult {
  const tree = sanitizePresentTree(input);
  if (!tree) {
    if (isRecord(input) && typeof input.$type === "string") {
      if (!TYPE_SET.has(input.$type)) {
        return {
          ok: false,
          message: `Unknown present $type “${input.$type}”.`,
        };
      }
      if (input.$type === "Image") {
        return {
          ok: false,
          message: "present Image src must be an http(s) URL.",
        };
      }
      if (input.$type === "File") {
        return {
          ok: false,
          message: "present File needs an office-root path (no ..).",
        };
      }
    }
    return {
      ok: false,
      message: "present needs a $type from the office UI vocabulary.",
    };
  }
  return {
    ok: true,
    $type: tree.$type,
    preview: presentPreview(tree),
  };
}

export function presentPreview(tree: unknown): string {
  const node = asNode(tree);
  if (!node) return "";
  const title = str(node.title);
  if (title) return clip(title);
  if (node.$type === "File") {
    const path = str(node.path);
    const name = path.split("/").filter(Boolean).at(-1) ?? path;
    if (name) return clip(name);
  }
  const text = str(node.text) || str(node.value);
  if (node.$type === "Fact") {
    const label = str(node.label);
    if (label && text) return clip(`${label} ${text}`);
  }
  if (text) return clip(text);
  const label = str(node.label);
  if (label) return clip(label);
  const children = childList(node.children);
  for (const child of children) {
    const next = presentPreview(child);
    if (next) return next;
  }
  return clip(node.$type);
}

export function presentTreeFromToolPart(part: unknown): unknown | null {
  if (!isRecord(part)) return null;
  const type = typeof part.type === "string" ? part.type : "";
  const toolName =
    typeof part.toolName === "string"
      ? part.toolName
      : type === `tool-${PRESENT_TOOL_NAME}`
        ? PRESENT_TOOL_NAME
        : "";
  if (toolName !== PRESENT_TOOL_NAME && type !== `tool-${PRESENT_TOOL_NAME}`) {
    return null;
  }
  return part.input ?? part.args ?? null;
}

export function presentPreviewFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  for (let i = parts.length - 1; i >= 0; i--) {
    const tree = presentTreeFromToolPart(parts[i]);
    if (!tree) continue;
    const preview = presentPreview(tree);
    if (preview) return preview;
  }
  return "";
}

/** Models often pass `children` as a JSON string. Turn that back into a tree. */
export function coercePresentInput(input: unknown): unknown {
  if (typeof input === "string") {
    const parsed = tryParsePresentJson(input);
    return parsed === undefined ? input : coercePresentInput(parsed);
  }
  if (Array.isArray(input)) {
    const out: unknown[] = [];
    for (const item of input) {
      if (typeof item === "string") {
        const parsed = tryParsePresentJson(item);
        if (parsed === undefined) {
          out.push(item);
          continue;
        }
        const next = coercePresentInput(parsed);
        if (Array.isArray(parsed)) {
          out.push(...(Array.isArray(next) ? next : [next]));
        } else {
          out.push(next);
        }
        continue;
      }
      out.push(coercePresentInput(item));
    }
    return out;
  }
  if (isRecord(input) && "children" in input) {
    return { ...input, children: coercePresentInput(input.children) };
  }
  return input;
}

export function sanitizePresentTree(
  input: unknown,
  depth = 0,
  tally = { n: 0 },
): PresentNode | null {
  if (depth > PRESENT_MAX_DEPTH) return null;
  const node = asNode(depth === 0 ? coercePresentInput(input) : input);
  if (!node || !TYPE_SET.has(node.$type)) return null;
  if (tally.n >= PRESENT_MAX_NODES) return null;
  tally.n += 1;

  if (node.$type === "Image") {
    const src = safePresentImageSrc(str(node.src));
    if (!src) return null;
    return { ...node, src, children: undefined };
  }

  if (node.$type === "File") {
    const path = safePresentFilePath(str(node.path));
    if (!path) return null;
    const place = str(node.place) === "knowledge" ? "knowledge" : "computer";
    const title = str(node.title);
    return {
      $type: "File",
      path,
      place,
      ...(title ? { title } : {}),
    };
  }

  const kids = childList(node.children)
    .map((child) => {
      if (typeof child === "string") {
        const text = child.trim();
        if (!text || tally.n >= PRESENT_MAX_NODES) return null;
        // Incomplete or leftover stringified JSON — do not paint it as a caption.
        if (text.startsWith("{") || text.startsWith("[")) return null;
        tally.n += 1;
        return { $type: "Text", value: clip(text, 4000) } satisfies PresentNode;
      }
      return sanitizePresentTree(child, depth + 1, tally);
    })
    .filter((row): row is PresentNode => row !== null);

  const next: PresentNode = { ...node };
  if (
    (node.$type === "Badge" ||
      node.$type === "Text" ||
      node.$type === "Caption" ||
      node.$type === "Markdown") &&
    !str(node.value) &&
    str(node.text)
  ) {
    next.value = str(node.text);
  }
  if (kids.length > 0) next.children = kids;
  else delete next.children;
  return next;
}

export type PresentNode = {
  $type: string;
  children?: PresentNode[];
  [key: string]: unknown;
};

export function safePresentImageSrc(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

const MAX_FILE_PATH = 240;

export function safePresentFilePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) return null;
  const pathPart = trimmed.split(/[?#]/u, 1)[0] ?? "";
  const normalized = pathPart.replaceAll("\\", "/").replace(/^\/+/u, "");
  if (!normalized || normalized === ".") return null;
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." || part.includes("\0")) return null;
    parts.push(part);
  }
  const path = parts.join("/");
  if (!path || path.length > MAX_FILE_PATH) return null;
  return path;
}

function asNode(value: unknown): PresentNode | null {
  if (!isRecord(value)) return null;
  const type = value.$type;
  if (typeof type !== "string" || !type.trim()) return null;
  return value as PresentNode;
}

function childList(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clip(value: string, max = 140): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).trim() : text;
}

function tryParsePresentJson(raw: string): unknown | undefined {
  const text = raw.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
