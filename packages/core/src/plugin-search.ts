/** Short Composio search queries. Sentence queries match nothing. */

const STOP = new Set([
  "a",
  "an",
  "and",
  "at",
  "available",
  "bulk",
  "can",
  "check",
  "for",
  "from",
  "get",
  "hey",
  "in",
  "list",
  "look",
  "me",
  "message",
  "messages",
  "my",
  "of",
  "on",
  "or",
  "please",
  "read",
  "recent",
  "show",
  "the",
  "to",
  "with",
  "you",
]);

const MAIL_WORDS = new Set([
  "email",
  "emails",
  "gmail",
  "inbox",
  "mail",
  "unread",
]);

/** Tool slug like GMAIL_FETCH_EMAILS — pass through. */
const SLUG = /^[A-Za-z][A-Za-z0-9_]{3,}$/;

/** How many tools to ask Composio for (it pages alphabetically). */
export const PLUGIN_SEARCH_FETCH_LIMIT = 40;
/** How many ranked hits the sandbox sees. */
export const PLUGIN_SEARCH_MAX_HITS = 8;

export function pluginSearchQuery(
  raw: string,
  toolkits: readonly string[] = [],
): string {
  const original = raw.trim();
  if (!original) return "";
  if (SLUG.test(original) && original.includes("_")) return original;

  const text = original.toLowerCase().replace(/[_-]+/g, " ");
  const tokens = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const kits = [
    ...new Set(
      toolkits.map((row) => row.trim().toLowerCase()).filter(Boolean),
    ),
  ];

  const mentioned = kits.find(
    (kit) => tokens.includes(kit) || text.includes(kit),
  );
  if (mentioned) return mentioned;

  if (kits.includes("gmail") && tokens.some((token) => MAIL_WORDS.has(token))) {
    return "gmail";
  }

  const meaningful = tokens.filter(
    (token) => !STOP.has(token) && token.length > 1,
  );
  if (meaningful.length === 1) return meaningful[0]!;
  if (meaningful.length === 2) return meaningful.join(" ");
  if (kits[0]) return kits[0];
  return meaningful[0] || original.slice(0, 40);
}

export type PluginSearchParams = {
  important: true;
  limit: number;
  query?: string;
};

/** Toolkit browse uses Composio `important=true` (featured tools, not A–Z). */
export function pluginSearchParams(
  raw: string,
  toolkits: readonly string[] = [],
): PluginSearchParams {
  const q = pluginSearchQuery(raw, toolkits);
  const kits = new Set(
    toolkits.map((row) => row.trim().toLowerCase()).filter(Boolean),
  );
  const toolkitBrowse = Boolean(q && kits.has(q.toLowerCase()));
  return {
    important: true,
    limit: PLUGIN_SEARCH_FETCH_LIMIT,
    ...(toolkitBrowse || !q ? {} : { query: q }),
  };
}

/** Composio Gmail defaults dump full MIME. Metadata-first unless the model asks. */
export function pluginExecuteArguments(
  slug: string,
  args: Record<string, unknown> = {},
): Record<string, unknown> {
  if (slug === "GMAIL_FETCH_EMAILS") {
    return {
      verbose: false,
      include_payload: false,
      max_results: 5,
      query: "in:inbox",
      ...args,
    };
  }
  if (slug === "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID") {
    return { format: "metadata", ...args };
  }
  return { ...args };
}

/** Fetch/list/send first. Labels and batch-delete last. */
export function rankPluginHits<T extends { slug: string; name?: string }>(
  hits: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const hit of hits) {
    const key = hit.slug.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(hit);
  }
  return unique
    .map((hit, index) => ({ hit, index, score: scorePluginHit(hit, q) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, PLUGIN_SEARCH_MAX_HITS)
    .map((row) => row.hit);
}

function scorePluginHit(
  hit: { slug: string; name?: string },
  query: string,
): number {
  const slug = hit.slug.toLowerCase();
  const name = (hit.name ?? "").toLowerCase();
  let score = 0;
  if (/_fetch_|_list_|_get_|_search_|_send_|_read_/.test(slug)) score += 8;
  if (
    /fetch_emails$/.test(slug) &&
    !/(^|[^a-z])send([^a-z]|$)/.test(query)
  ) {
    score += 10;
  }
  if (/fetch_email|list_message|list_email|send_email|send_message/.test(slug)) {
    score += 6;
  }
  if (
    /_label|_batch_|_filter|_prompt_|delete_draft|create_label|add_label/.test(
      slug,
    )
  ) {
    score -= 12;
  }
  for (const token of query.split(/[^\p{L}\p{N}]+/u)) {
    if (token.length < 2) continue;
    if (slug.includes(token) || name.includes(token)) score += 4;
  }
  return score;
}
