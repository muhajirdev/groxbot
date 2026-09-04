/** Office system prompt: identity plus Available tools from the live catalog (Pi coding-agent shape). */

import { PRESENT_TOOL_NAME } from "@groxbot/contracts";
import { COMPUTER_SHELL_TOOL_NAME } from "./computer-fs.js";
import { OFFICE_CODE_TOOL_NAME } from "./execute-imports.js";
import { KNOWLEDGE_MARKDOWN_LINK_HINT } from "./knowledge-links.js";
import { SKILL_TOOL_NAME } from "./office-skill.js";

export const OFFICE_SET_CONTEXT_TOOL_NAME = "set_context";

export type OfficePromptTool = {
  name: string;
  description?: string;
};

export type OfficeToolPromptContribution = {
  snippet: string;
  guidelines?: readonly string[];
};

export const OFFICE_TOOL_PROMPT: Record<string, OfficeToolPromptContribution> = {
  [OFFICE_SET_CONTEXT_TOOL_NAME]: {
    snippet:
      "Save who you are (soul) or short facts about this office (memory). Top-level tool — not a global inside code.",
    guidelines: [
      "Call set_context as a top-level tool. It is not a global inside code. label is soul or memory; mode is replace or append. Keep your name on soul.",
    ],
  },
  [OFFICE_CODE_TOOL_NAME]: {
    snippet:
      "JavaScript sandbox for knowledge, routines, history, and page helpers. Argument is `code`, not a bash command. You can import npm packages.",
    guidelines: [
      "knowledge, routines, and history live inside code (`await knowledge.search({ query })`, `await knowledge.read({ path })`, `await routines.list()`, `await history.search({ query })`). set_context, skill_manage, present, and shell are top-level tools, not sandbox globals.",
      KNOWLEDGE_MARKDOWN_LINK_HINT,
    ],
  },
  [COMPUTER_SHELL_TOOL_NAME]: {
    snippet:
      "Bash on this computer (just-bash). Argument is `command`. cwd is /workspace.",
    guidelines: [
      "Use shell for bash on this computer. Do not use code for bash, and do not unpack binary streams in the shell.",
    ],
  },
  list: { snippet: "List files on this computer." },
  read: { snippet: "Read a file on this computer." },
  write: { snippet: "Write a file on this computer." },
  edit: { snippet: "Patch a file on this computer." },
  delete: { snippet: "Delete a file on this computer." },
  find: { snippet: "Find files on this computer by name." },
  grep: { snippet: "Search file contents on this computer." },
  publish: { snippet: "Publish an asset from this computer." },
  web_search: {
    snippet: "Search the public web (TinyFish).",
    guidelines: [
      "Search the public web with web_search, then read a page with fetch_url. Do not open a browser just to read a page.",
    ],
  },
  fetch_url: { snippet: "Read a public URL (TinyFish)." },
  to_markdown: {
    snippet: "Convert HTML or a computer file (PDF/doc) to Markdown.",
  },
  [PRESENT_TOOL_NAME]: {
    snippet:
      "Show a glanceable JSON tree in the thread (`$type` plus `children`). Facts, a short table, a chart, or a File chip.",
    guidelines: [
      "For a glanceable result, call present with a JSON tree (`$type` plus `children`). Put long notes and drafts in a file on this computer, then present a File with that path (`place` computer). After skill_manage create/patch, present a File with the office path (`place` knowledge).",
    ],
  },
  [SKILL_TOOL_NAME]: {
    snippet:
      "Create or patch a SKILL.md in the office library at skills/<name>/SKILL.md.",
    guidelines: [
      "Reusable how-to is a skill. Patch an existing skill before creating one. YAML name + description required. /skill:name loads it for this turn. /learn a source or workflow authors one.",
    ],
  },
  room_list: { snippet: "List papers in this room. Not your computer." },
  room_read: { snippet: "Read a paper in this room." },
  room_write: {
    snippet: "Write a paper in this room. Shared with everyone seated here.",
  },
};

const COMPUTER_FS_TOOLS = new Set([
  "list",
  "read",
  "write",
  "edit",
  "delete",
  "find",
  "grep",
]);

export function officeCanReadSkills(
  tools: readonly Pick<OfficePromptTool, "name">[],
): boolean {
  return tools.some((row) => row.name === OFFICE_CODE_TOOL_NAME);
}

export function officeToolPromptContribution(
  name: string,
  description?: string,
): OfficeToolPromptContribution | null {
  const known = OFFICE_TOOL_PROMPT[name];
  if (known) return known;
  const snippet = firstSentence(description ?? "");
  return snippet ? { snippet } : null;
}

export function officeMcpGuideline(names: readonly string[]): string | null {
  const listed = [
    ...new Set(names.map((name) => name.trim()).filter(Boolean)),
  ];
  if (listed.length === 0) return null;
  const ticks = listed.map((name) => `\`${name}\``).join(", ");
  const first = listed[0]!;
  return `Workspace MCP inside code: ${ticks}. Call \`await ${first}.<method>(args)\`. Not a top-level tool. Search for methods, then \`await codemode.describe("${first}.<method>")\` — do not describe the whole connector.`;
}

export function buildOfficeSystemPrompt(opts: {
  identity: string;
  tools: readonly OfficePromptTool[];
  mcp?: readonly string[];
}): string {
  const names = opts.tools.map((row) => row.name).filter(Boolean);
  const byName = new Map(opts.tools.map((row) => [row.name, row]));
  const mcpGuideline = names.includes(OFFICE_CODE_TOOL_NAME)
    ? officeMcpGuideline(opts.mcp ?? [])
    : null;
  const visible: string[] = [];
  for (const name of names) {
    const contribution = officeToolPromptContribution(
      name,
      byName.get(name)?.description,
    );
    if (!contribution) continue;
    const snippet =
      name === OFFICE_CODE_TOOL_NAME && mcpGuideline
        ? contribution.snippet.replace(
            "knowledge, routines, history, and page helpers",
            "knowledge, routines, history, page helpers, and workspace MCP",
          )
        : contribution.snippet;
    visible.push(`- ${name}: ${snippet}`);
  }
  const toolsList = visible.length > 0 ? visible.join("\n") : "(none)";

  const guidelines: string[] = [];
  const seen = new Set<string>();
  const add = (guideline: string) => {
    const next = guideline.trim();
    if (!next || seen.has(next)) return;
    seen.add(next);
    guidelines.push(next);
  };

  add(
    "Be concise. A few sentences. Do the work with tools; don't narrate every step. Don't announce a save you didn't make.",
  );
  if (names.some((name) => COMPUTER_FS_TOOLS.has(name))) {
    add(
      "list / read / write / edit / grep / find / delete are this computer. The office library is knowledge inside code.",
    );
  }
  for (const name of names) {
    for (const guideline of officeToolPromptContribution(
      name,
      byName.get(name)?.description,
    )?.guidelines ?? []) {
      add(guideline);
    }
  }
  if (mcpGuideline) add(mcpGuideline);
  if (names.length === 1 && names[0] === OFFICE_SET_CONTEXT_TOOL_NAME) {
    add(
      "This turn only has set_context. Call that tool first (label soul, mode replace), then greet in 1–2 short lines and ask if they want a role, personality, or working style. Do not write the overlay as chat text.",
    );
  }

  const body = guidelines.map((row) => `- ${row}`).join("\n");
  return `${opts.identity.trim()}

Available tools:
${toolsList}

Guidelines:
${body}`;
}

function firstSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const cut = trimmed.search(/[.!?]\s/);
  const line = cut === -1 ? trimmed : trimmed.slice(0, cut + 1);
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}
