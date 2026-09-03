/** Allow http(s) and mailto only. Chat never follows office paths. */
export function safeMarkdownUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed))
    return trimmed;
  return null;
}

export type MdInline =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type MdBlock =
  | { kind: "p"; inlines: MdInline[] }
  | { kind: "h"; level: 1 | 2 | 3; inlines: MdInline[] }
  | { kind: "quote"; inlines: MdInline[] }
  | { kind: "code"; text: string }
  | { kind: "ul"; items: MdInline[][] }
  | { kind: "ol"; items: MdInline[][] };

const INLINE =
  /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

export function parseInline(text: string): MdInline[] {
  const out: MdInline[] = [];
  let cursor = 0;
  INLINE.lastIndex = 0;
  let match = INLINE.exec(text);
  while (match) {
    if (match.index > cursor) {
      out.push({ kind: "text", text: text.slice(cursor, match.index) });
    }
    if (match[2]) out.push({ kind: "strong", text: match[2] });
    else if (match[3]) out.push({ kind: "em", text: match[3] });
    else if (match[4]) out.push({ kind: "code", text: match[4] });
    else if (match[5] != null && match[6] != null) {
      out.push({ kind: "link", text: match[5], href: match[6] });
    }
    cursor = match.index + match[0].length;
    match = INLINE.exec(text);
  }
  if (cursor < text.length)
    out.push({ kind: "text", text: text.slice(cursor) });
  return out.length > 0 ? out : [{ kind: "text", text }];
}

export function parseChatMarkdown(source: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("```")) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level =
        heading[1]?.length === 1 ? 1 : heading[1]?.length === 2 ? 2 : 3;
      blocks.push({
        kind: "h",
        level,
        inlines: parseInline(heading[2] ?? ""),
      });
      i += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      blocks.push({ kind: "quote", inlines: parseInline(line.slice(2)) });
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: MdInline[][] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? "")) {
        items.push(parseInline((lines[i] ?? "").replace(/^\s*[-*]\s+/, "")));
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: MdInline[][] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? "")) {
        items.push(parseInline((lines[i] ?? "").replace(/^\s*\d+\.\s+/, "")));
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^(#{1,3}\s+|```|> |\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i] ?? "")
    ) {
      para.push(lines[i] ?? "");
      i += 1;
    }
    blocks.push({ kind: "p", inlines: parseInline(para.join(" ")) });
  }
  return blocks;
}
