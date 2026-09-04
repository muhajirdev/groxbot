/** Cloudflare-only. Excluded from `tsc`. */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { WorkersAiBinding } from "@groxbot/adapters/edge";
import {
  PUBLIC_FETCH_ALLOWLIST,
  runPublicFetch,
  runTinyfishFetch,
  runTinyfishSearch,
  runToMarkdown,
  sanitizeComputerPath,
  tinyfishConfigured,
  type MarkdownBytes,
  type MarkdownDisk,
  type TinyfishKeyPool,
} from "@groxbot/core";
import { z } from "zod";
import { officeAgentTool } from "./bot-office-tools.js";

export type PageWorkspace = MarkdownDisk & {
  writeFile(path: string, content: string): Promise<void> | void;
  writeFileBytes?(path: string, content: Uint8Array): Promise<void> | void;
  mkdir?(
    path: string,
    opts?: { recursive?: boolean },
  ): Promise<void> | void;
};

export const WEB_SEARCH_DESCRIPTION =
  "Search the public web (TinyFish). Returns ranked titles, snippets, and URLs. Then fetch_url a result you need to read. Do not open a browser just to search.";

export const FETCH_URL_DESCRIPTION =
  "Read a public http(s) URL (TinyFish). Loopback and private nets are blocked. Returns clean Markdown when TinyFish is set; otherwise a plain GET. Large bodies land in inbox/fetch on this computer. Do not open a browser just to read a page.";

export const TO_MARKDOWN_DESCRIPTION =
  "Convert HTML, a PDF, or a file on this computer to Markdown. Use fetch_url first for a public page, then pass the HTML body here. Pass a workspace path for a file already on this computer. Do not use the browser just to read a page.";

export const webSearchParameters = z.object({
  query: z.string().min(1).describe("What to search the public web for."),
  purpose: z
    .string()
    .optional()
    .describe("Why you are searching — a short goal, not the query."),
});

export const fetchUrlParameters = z.object({
  url: z.string().min(1).describe("Public http(s) URL to read."),
});

export const toMarkdownParameters = z.object({
  html: z
    .string()
    .optional()
    .describe("HTML body from fetch_url (or any HTML string)."),
  path: z
    .string()
    .optional()
    .describe("Path on this computer, e.g. inbox/spec.pdf."),
  name: z
    .string()
    .optional()
    .describe("Optional filename used to pick a MIME type."),
});

export type PageToolsOpts = {
  workspace: PageWorkspace;
  convert?: (file: MarkdownBytes) => Promise<unknown>;
  tinyfishApiKey?: string;
  tinyfishKeys?: TinyfishKeyPool | readonly string[];
  fetch?: typeof fetch;
};

export function bindToMarkdown(ai: WorkersAiBinding | undefined) {
  if (!ai?.toMarkdown) return undefined;
  const toMarkdown = ai.toMarkdown.bind(ai);
  return (file: MarkdownBytes) =>
    toMarkdown({
      name: file.name,
      blob: new Blob([file.bytes], { type: file.mimeType }),
    });
}

export async function runWebSearchTool(
  input: { query: string; purpose?: string },
  opts?: Pick<PageToolsOpts, "tinyfishApiKey" | "tinyfishKeys" | "fetch">,
): Promise<unknown> {
  return runTinyfishSearch({
    query: input.query,
    purpose: input.purpose,
    apiKey: opts?.tinyfishApiKey,
    keys: opts?.tinyfishKeys,
    fetch: opts?.fetch,
  });
}

export async function runFetchUrlTool(
  workspace: PageWorkspace,
  url: string,
  opts?: Pick<PageToolsOpts, "tinyfishApiKey" | "tinyfishKeys" | "fetch">,
): Promise<unknown> {
  if (tinyfishConfigured(opts?.tinyfishKeys ?? opts?.tinyfishApiKey)) {
    return runTinyfishFetch({
      url,
      apiKey: opts?.tinyfishApiKey,
      keys: opts?.tinyfishKeys,
      fetch: opts?.fetch,
      workspace,
      spillToWorkspace: true,
    });
  }
  return runPublicFetch({
    url,
    allowlist: PUBLIC_FETCH_ALLOWLIST,
    workspace,
    spillToWorkspace: true,
    fetch: opts?.fetch,
  });
}

export async function runToMarkdownTool(
  opts: {
    workspace: MarkdownDisk;
    convert?: (file: MarkdownBytes) => Promise<unknown>;
  },
  input: { html?: string; path?: string; name?: string },
): Promise<unknown> {
  return runToMarkdown({
    input,
    workspace: opts.workspace,
    convert: opts.convert,
    sanitizePath: sanitizeComputerPath,
  });
}

export function createPageAgentTools(opts: PageToolsOpts): AgentTool[] {
  return [
    officeAgentTool({
      name: "web_search",
      description: WEB_SEARCH_DESCRIPTION,
      parameters: webSearchParameters,
      execute: async (input) =>
        runWebSearchTool(
          {
            query: String(input.query ?? ""),
            purpose:
              typeof input.purpose === "string" ? input.purpose : undefined,
          },
          opts,
        ),
    }),
    officeAgentTool({
      name: "fetch_url",
      description: FETCH_URL_DESCRIPTION,
      parameters: fetchUrlParameters,
      execute: async ({ url }) =>
        runFetchUrlTool(opts.workspace, String(url ?? ""), opts),
    }),
    officeAgentTool({
      name: "to_markdown",
      description: TO_MARKDOWN_DESCRIPTION,
      parameters: toMarkdownParameters,
      execute: async (input) =>
        runToMarkdownTool(opts, {
          html: typeof input.html === "string" ? input.html : undefined,
          path: typeof input.path === "string" ? input.path : undefined,
          name: typeof input.name === "string" ? input.name : undefined,
        }),
    }),
  ];
}
