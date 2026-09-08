/** Cloudflare-only. Browser Run Quick Actions → files on this computer. */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  officeImageToolResult,
  runBrowserQuickAction,
  type BrowserQuickAction,
  type BrowserRenderDisk,
  type BrowserRenderSource,
} from "@groxbot/core";
import { z } from "zod";
import { officeAgentTool } from "./bot-office-tools.js";

export const RENDER_PDF_DESCRIPTION =
  "Render HTML or a public URL to a PDF on this computer (Cloudflare Browser). Pass html, url, or path to an HTML file. Do not use for ordinary page reading — use fetch_url.";

export const RENDER_SCREENSHOT_DESCRIPTION =
  "Capture a PNG screenshot of HTML or a public URL on this computer (Cloudflare Browser). The result includes the image so you can check layout — do not read the PNG to see it. Pass html, url, or path to an HTML file. Do not use for ordinary page reading — use fetch_url.";

const pageSourceFields = {
  html: z
    .string()
    .optional()
    .describe("Raw HTML to load in the browser."),
  url: z
    .string()
    .optional()
    .describe("Public http(s) URL to open."),
  path: z
    .string()
    .optional()
    .describe("Path to an HTML file on this computer."),
  out: z
    .string()
    .optional()
    .describe("Optional output path on this computer."),
};

export const renderPdfParameters = z.object(pageSourceFields);
export const renderScreenshotParameters = z.object(pageSourceFields);

export type BrowserToolsOpts = {
  browser: BrowserQuickAction;
  workspace: BrowserRenderDisk;
};

export async function runRenderPdfTool(
  opts: BrowserToolsOpts,
  input: BrowserRenderSource,
) {
  return runBrowserQuickAction(opts.browser, opts.workspace, "pdf", input);
}

export async function runRenderScreenshotTool(
  opts: BrowserToolsOpts,
  input: BrowserRenderSource,
) {
  return runBrowserQuickAction(
    opts.browser,
    opts.workspace,
    "screenshot",
    input,
  );
}

function sourceFromInput(input: Record<string, unknown>): BrowserRenderSource {
  return {
    html: typeof input.html === "string" ? input.html : undefined,
    url: typeof input.url === "string" ? input.url : undefined,
    path: typeof input.path === "string" ? input.path : undefined,
    out: typeof input.out === "string" ? input.out : undefined,
  };
}

export function createBrowserAgentTools(opts: BrowserToolsOpts): AgentTool[] {
  return [
    officeAgentTool({
      name: "render_pdf",
      description: RENDER_PDF_DESCRIPTION,
      parameters: renderPdfParameters,
      execute: async (input) =>
        runRenderPdfTool(opts, sourceFromInput(input)),
    }),
    officeAgentTool({
      name: "render_screenshot",
      description: RENDER_SCREENSHOT_DESCRIPTION,
      parameters: renderScreenshotParameters,
      execute: async (input) => {
        const result = await runRenderScreenshotTool(
          opts,
          sourceFromInput(input),
        );
        if (!result.ok || !result.data) return result;
        return officeImageToolResult({
          path: result.path,
          data: result.data,
          mimeType: result.mediaType,
          text: `Screenshot saved to ${result.path} (${result.bytes} bytes).`,
        });
      },
    }),
  ];
}
