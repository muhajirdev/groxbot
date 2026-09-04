/** Cloudflare-only. Excluded from `tsc`. */
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { WorkersAiBinding } from "@groxbot/adapters/edge";
import {
  PUBLIC_FETCH_ALLOWLIST,
  runPublicFetch,
  runToMarkdown,
  sanitizeComputerPath,
  type MarkdownBytes,
  type MarkdownDisk,
} from "@groxbot/core";

type PageWorkspace = MarkdownDisk & {
  writeFile(path: string, content: string): Promise<void> | void;
  writeFileBytes?(path: string, content: Uint8Array): Promise<void> | void;
  mkdir?(
    path: string,
    opts?: { recursive?: boolean },
  ): Promise<void> | void;
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

export function createPageTools(opts: {
  workspace: PageWorkspace;
  convert?: (file: MarkdownBytes) => Promise<unknown>;
}): ToolSet {
  return {
    fetch_url: createFetchUrlTool(opts.workspace),
    to_markdown: createToMarkdownTool(opts),
  };
}

function createFetchUrlTool(workspace: PageWorkspace) {
  return tool({
    description:
      "GET a public http(s) URL. Loopback and private nets are blocked. Large or binary bodies land in inbox/fetch on this computer.",
    inputSchema: z.object({
      url: z.string().min(1).describe("Public http(s) URL to read."),
    }),
    execute: async ({ url }) =>
      runPublicFetch({
        url,
        allowlist: PUBLIC_FETCH_ALLOWLIST,
        workspace,
        spillToWorkspace: true,
      }),
  });
}

function createToMarkdownTool(opts: {
  workspace: MarkdownDisk;
  convert?: (file: MarkdownBytes) => Promise<unknown>;
}) {
  return tool({
    description:
      "Convert HTML, a PDF, or a file on this computer to Markdown. Use fetch_url first for a public page, then pass the HTML body here. Pass a workspace path for a file already on this computer. Do not use the browser just to read a page.",
    inputSchema: z.object({
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
    }),
    execute: async (input) =>
      runToMarkdown({
        input,
        workspace: opts.workspace,
        convert: opts.convert,
        sanitizePath: sanitizeComputerPath,
      }),
  });
}
