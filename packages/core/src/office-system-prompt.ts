/** Office system prompt: identity plus Available tools from the live catalog (Pi coding-agent shape). */

import { PRESENT_TOOL_NAME } from "@groxbot/contracts";
import { COMPUTER_SHELL_TOOL_NAME } from "./computer-fs.js";
import { OFFICE_CODE_TOOL_NAME } from "./execute-imports.js";
import { KNOWLEDGE_MARKDOWN_LINK_HINT } from "./knowledge-links.js";
import { OFFICE_STAMP_APP_TOOL_NAME } from "./office-app-card.js";
import { OFFICE_ASK_TOOL_NAME } from "./office-ask.js";
import { SKILL_TOOL_NAME } from "./office-skill.js";

export const OFFICE_SET_CONTEXT_TOOL_NAME = "set_context";
export const OFFICE_APP_TOOL_NAME = "app";

export type OfficePromptTool = {
  name: string;
  description?: string;
};

export type OfficeToolPromptContribution = {
  snippet: string;
  guidelines?: readonly string[];
};

export const OFFICE_TOOL_PROMPT: Record<string, OfficeToolPromptContribution> =
  {
    [OFFICE_SET_CONTEXT_TOOL_NAME]: {
      snippet:
        "Save who you are (soul) or short facts about this office (memory). Top-level tool — not a global inside code.",
      guidelines: [
        "Call set_context as a top-level tool. It is not a global inside code. label is soul or memory; mode is replace or append. Keep your name on soul.",
      ],
    },
    [OFFICE_CODE_TOOL_NAME]: {
      snippet:
        "JavaScript sandbox for knowledge, routines, history, bots, and page helpers. Argument is `code`, not a bash command. You can import npm packages.",
      guidelines: [
        "knowledge, routines, history, and bots live inside code (`await knowledge.search({ query })`, `await knowledge.read({ path })`, `await knowledge.write({ path, content })` or `from` for a computer PDF, `await routines.list()`, `await history.search({ query })`, `await bots.search({ query })`, `await bots.hire({ marketplaceId })`). Hire needs approval. set_context, skill_manage, present, ask, stamp_app, and shell are top-level tools, not sandbox globals.",
        KNOWLEDGE_MARKDOWN_LINK_HINT,
      ],
    },
    [COMPUTER_SHELL_TOOL_NAME]: {
      snippet:
        "just-bash on this computer (not Linux). Argument is `command`. cwd is /workspace. No pdfinfo/pdftotext — read() converts PDFs. Long output is the tail; full dump at /workspace/.tool-output/shell.txt.",
      guidelines: [
        "Use shell for just-bash on this computer — core text commands (ls, cat, sed, mkdir). Not a Linux container: no pdfinfo, pdftotext, apt, or GNU date -I. PDFs: use read(); it already converted them. Do not use code for bash. Long shell output is the last 2000 lines or 50KB; read /workspace/.tool-output/shell.txt for the rest.",
      ],
    },
    list: { snippet: "List files on this computer. offset pages." },
    read: {
      snippet:
        "Read a file on this computer. offset continues. PDFs and Office docs convert to markdown. Images are shown in this result — you see the picture, not a caption.",
    },
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
      snippet:
        "Convert HTML from fetch_url, or a computer file, to Markdown. Prefer read() for PDFs already on this computer. Prefer read() to see an image. Pass path or html, not both — omit empty html. Convert each file once. If the result already has the markdown, use it — do not cat, grep, or read the spill. Only continue with offset or read() when the result says to; do not convert again.",
    },
    render_pdf: {
      snippet: "Render HTML or a URL to a PDF on this computer.",
      guidelines: [
        "Use render_pdf or render_screenshot to print HTML or a URL. Do not open a browser just to read a page — use fetch_url.",
      ],
    },
    render_screenshot: {
      snippet:
        "Capture a PNG of HTML or a URL on this computer. The result includes the image so you can check layout — do not read the PNG to see it.",
      guidelines: [
        "render_screenshot includes the image. Check layout from that result. Do not read the PNG to see it.",
      ],
    },
    [PRESENT_TOOL_NAME]: {
      snippet:
        "Show a glanceable JSON tree in the thread (`$type` plus `children`). Facts, a short table, a chart, or a File chip.",
      guidelines: [
        "For a glanceable result, call present with a JSON tree (`$type` plus `children`). Put long notes and drafts in a file on this computer, then present a File with that path (`place` computer). After skill_manage create/patch, present a File with the office path (`place` knowledge).",
      ],
    },
    [OFFICE_STAMP_APP_TOOL_NAME]: {
      snippet:
        "Create any live app. For a custom gadget pass title, clientJs, and serverJs (`export class Gadget`). Built-in templateId docs|slides|sheets|crm|game skips the files. A card appears when this returns.",
      guidelines: [
        "When they want a live app, call stamp_app. Write client.js and server.js for anything that is not a built-in doc, deck, sheet, CRM, or tic-tac-toe. Do not invent a markdown stand-in. Never say an app exists unless stamp_app returned ok. Open is for the human. Do not ask which kind if they already asked you to make one — pick and stamp.",
      ],
    },
    [OFFICE_ASK_TOOL_NAME]: {
      snippet:
        "Ask the human a question and wait. Prefer short options. Not for hire/send/spend.",
      guidelines: [
        "When a preference or missing fact blocks the work, call ask and wait. Prefer 2–4 short options. Do not guess a choice you can ask in one tap. Hire/send/spend/delete still need approval, not ask. If ask says no one is watching, continue with your best judgment.",
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
    [OFFICE_APP_TOOL_NAME]: {
      snippet:
        "The live app this room is looking at. Everyone here has it open. method is a Gadget RPC name (getDocument, setDocument, setDeck, applyOperation, initializeBlocks, getDeck, getGame, setGame, upsertContact, move, or whatever server.js exports); arguments is the args list.",
      guidelines: [
        "This room is looking at a live app. Use the app tool to read or change that document — do not invent a second copy. method is the Gadget RPC name; arguments is the list of args. set_context, skill_manage, present, ask, stamp_app, shell, and app are top-level tools, not sandbox globals.",
      ],
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
  const listed = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (listed.length === 0) return null;
  const ticks = listed.map((name) => `\`${name}\``).join(", ");
  const first = listed[0]!;
  return `Workspace MCP inside code: ${ticks}. Call \`await ${first}.<method>(args)\`. Not a top-level tool. If the connector is already listed, call it — do not \`codemode.search\` for it. Search for methods, then \`await codemode.describe("${first}.<method>")\` — do not describe the whole connector. Map/filter in code; return a compact projection, never \`console.log\` the raw payload.`;
}

export function officePluginsGuideline(
  toolkits: readonly string[],
): string | null {
  const listed = [
    ...new Set(toolkits.map((name) => name.trim()).filter(Boolean)),
  ];
  if (listed.length === 0) return null;
  const ticks = listed.map((name) => `\`${name}\``).join(", ");
  const example = listed[0]!;
  return `Connected plugin accounts inside code: ${ticks}. One \`await plugins.search({ query: "${example}" })\` — a short toolkit or verb, not a sentence. Then \`await plugins.execute({ slug, arguments })\`. Return a compact projection. Do not \`codemode.search\` for a connected plugin. If several accounts of the same app exist, pass \`account\` from search. Not a top-level tool.`;
}

function officeCodeSandboxPhrase(opts: {
  mcp: boolean;
  plugins: boolean;
}): string {
  const parts = ["knowledge", "routines", "history", "bots", "page helpers"];
  if (opts.mcp) parts.push("workspace MCP");
  if (opts.plugins) parts.push("plugins");
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

export function buildOfficeSystemPrompt(opts: {
  identity: string;
  tools: readonly OfficePromptTool[];
  mcp?: readonly string[];
  plugins?: readonly string[];
}): string {
  const names = opts.tools.map((row) => row.name).filter(Boolean);
  const byName = new Map(opts.tools.map((row) => [row.name, row]));
  const hasCode = names.includes(OFFICE_CODE_TOOL_NAME);
  const mcpGuideline = hasCode ? officeMcpGuideline(opts.mcp ?? []) : null;
  const pluginsGuideline = hasCode
    ? officePluginsGuideline(opts.plugins ?? [])
    : null;
  const visible: string[] = [];
  for (const name of names) {
    const contribution = officeToolPromptContribution(
      name,
      byName.get(name)?.description,
    );
    if (!contribution) continue;
    const snippet =
      name === OFFICE_CODE_TOOL_NAME
        ? contribution.snippet.replace(
            "knowledge, routines, history, bots, and page helpers",
            officeCodeSandboxPhrase({
              mcp: Boolean(mcpGuideline),
              plugins: Boolean(pluginsGuideline),
            }),
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
    "Be concise. A few sentences. A summary is counts and groups, not every row unless they asked for the full list. Do the work with tools; don't narrate every step. Don't announce a save you didn't make.",
  );
  if (names.some((name) => COMPUTER_FS_TOOLS.has(name))) {
    add(
      "list / read / write / edit / grep / find / delete are this computer. Paths like inbox/file.pdf or /inbox/file.pdf — inbox is not under /workspace. PDFs and Office docs: read converts them to markdown — do not pdfinfo or pdftotext in shell. Images: read shows the picture. Long files: read again with offset. find: pass path `/` for the whole disk. The office library is knowledge inside code.",
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
  if (pluginsGuideline) add(pluginsGuideline);
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
