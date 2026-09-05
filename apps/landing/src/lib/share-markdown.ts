/** Escape first, then add tags we control. Never pass raw HTML from a note. */

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function isHiddenSharePath(path: string): boolean {
  return (
    path === "_search" ||
    path.startsWith("_search/") ||
    path === "_links" ||
    path.startsWith("_links/")
  );
}

export function stripShareFrontMatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u);
  return match ? content.slice(match[0].length) : content;
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

function joinOfficePath(base: string, href: string): string | null {
  const parts = [
    ...base.split("/").filter(Boolean),
    ...href.split("/").filter(Boolean),
  ];
  const stack: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

export function resolveShareHref(
  href: string,
  opts: { currentPath: string; granted: string; kind: "file" | "folder" },
): { href: string; path?: string } | null {
  const raw = href.trim();
  if (!raw) return null;
  if (raw.startsWith("#")) return { href: raw };
  const lower = raw.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return null;
  }
  if (raw.startsWith("//")) return null;
  if (/^https:\/\//iu.test(raw)) return { href: raw };
  if (/^[a-z][a-z0-9+.-]*:/iu.test(raw)) return null;

  const hashIndex = raw.indexOf("#");
  const pathPart = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : raw.slice(hashIndex);
  let decoded = pathPart;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    return null;
  }
  decoded = decoded.replaceAll("\\", "/");
  const relative = decoded.startsWith("./") || decoded.startsWith("../");
  const cleaned = decoded.replace(/^\/+/u, "");
  const resolved = relative
    ? joinOfficePath(dirname(opts.currentPath), cleaned)
    : joinOfficePath("", cleaned);
  if (!resolved || isHiddenSharePath(resolved)) return null;
  const covered =
    opts.kind === "file"
      ? resolved === opts.granted
      : resolved === opts.granted || resolved.startsWith(`${opts.granted}/`);
  if (!covered) return null;
  return { href: `${resolved}${hash}`, path: resolved };
}

const RASTER = /\.(gif|jpe?g|png|webp)$/iu;

export function sharePageHref(shareId: string, path: string): string {
  return `/s/${encodeURIComponent(shareId)}?p=${encodeURIComponent(path)}`;
}

export function renderShareMarkdown(
  source: string,
  opts: {
    shareId: string;
    currentPath: string;
    granted: string;
    kind: "file" | "folder";
    rawUrl: (path: string) => string;
  },
): string {
  const body = stripShareFrontMatter(source).replaceAll("\r\n", "\n");
  const lines = body.split("\n");
  const html: string[] = [];
  let i = 0;
  let list: string[] | null = null;

  const flushList = () => {
    if (!list) return;
    html.push(`<ul>${list.join("")}</ul>`);
    list = null;
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("```")) {
      flushList();
      const fence: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        fence.push(lines[i] ?? "");
        i += 1;
      }
      i += 1;
      html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/u);
    if (heading) {
      flushList();
      const level = heading[1]?.length ?? 1;
      html.push(
        `<h${level}>${renderInline(heading[2] ?? "", opts)}</h${level}>`,
      );
      i += 1;
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/u);
    if (bullet) {
      list ??= [];
      list.push(`<li>${renderInline(bullet[1] ?? "", opts)}</li>`);
      i += 1;
      continue;
    }
    if (!line.trim()) {
      flushList();
      i += 1;
      continue;
    }
    flushList();
    html.push(`<p>${renderInline(line, opts)}</p>`);
    i += 1;
  }
  flushList();
  return html.join("");
}

function renderInline(
  text: string,
  opts: {
    shareId: string;
    currentPath: string;
    granted: string;
    kind: "file" | "folder";
    rawUrl: (path: string) => string;
  },
): string {
  const escaped = escapeHtml(text);
  const withCode = escaped.replace(/`([^`]+)`/gu, "<code>$1</code>");
  const withImages = withCode.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/gu,
    (_match, alt: string, href: string) => {
      const resolved = resolveShareHref(unescapeAttr(href), {
        currentPath: opts.currentPath,
        granted: opts.granted,
        kind: opts.kind,
      });
      if (!resolved) return alt;
      if (resolved.path && RASTER.test(resolved.path)) {
        return `<img src="${escapeHtml(opts.rawUrl(resolved.path))}" alt="${alt}">`;
      }
      if (!resolved.path && /^https:\/\//iu.test(resolved.href) && RASTER.test(resolved.href)) {
        return `<img src="${escapeHtml(resolved.href)}" alt="${alt}">`;
      }
      return alt;
    },
  );
  const withLinks = withImages.replace(
    /\[([^\]]+)\]\(([^)]+)\)/gu,
    (_match, label: string, href: string) => {
      const resolved = resolveShareHref(unescapeAttr(href), {
        currentPath: opts.currentPath,
        granted: opts.granted,
        kind: opts.kind,
      });
      if (!resolved) return label;
      const dest = resolved.path
        ? sharePageHref(opts.shareId, resolved.path)
        : resolved.href;
      const extra = resolved.path ? "" : ' rel="noopener noreferrer"';
      return `<a href="${escapeHtml(dest)}"${extra}>${label}</a>`;
    },
  );
  return withLinks
    .replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/gu, "<em>$1</em>");
}

function unescapeAttr(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}
