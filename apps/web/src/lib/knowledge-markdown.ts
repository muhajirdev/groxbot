export type KnowledgeMarkdownMeta = {
  title: string;
  description: string;
  updated: string;
  source: string;
};

const EMPTY_META: KnowledgeMarkdownMeta = {
  title: "",
  description: "",
  updated: "",
  source: "",
};

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u;

/** Strip fenced YAML from a note. Search already indexes title; this is preview-only. */
export function splitKnowledgeMarkdown(content: string): {
  meta: KnowledgeMarkdownMeta;
  body: string;
} {
  const match = content.match(FENCE);
  if (!match) return { meta: EMPTY_META, body: content };
  const block = match[1] ?? "";
  const body = content.slice(match[0].length);
  return {
    meta: {
      title: yamlScalar(block, "title") || yamlScalar(block, "name"),
      description: yamlScalar(block, "description"),
      updated: yamlScalar(block, "updated"),
      source: yamlScalar(block, "source"),
    },
    body,
  };
}

export function knowledgeMarkdownHasHeading(body: string): boolean {
  const first = body.trimStart().split(/\r?\n/u, 1)[0] ?? "";
  return /^#{1,6}\s+\S/u.test(first);
}

function yamlScalar(block: string, key: string): string {
  const match = block.match(new RegExp(`^${key}:\\s*(.*)$`, "mu"));
  if (!match?.[1]) return "";
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value.trim();
}
