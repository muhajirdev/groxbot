/** Cloudflare-only. Browser Run Quick Actions + Stagehand act. */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Stagehand } from "@browserbasehq/stagehand";
import { endpointURLString } from "@cloudflare/playwright";
import {
  resolveBrowserPage,
  runBrowserQuickAction,
  writeBrowserRenderBytes,
  browserRenderOutPath,
  type BrowserQuickAction,
  type BrowserRenderDisk,
  type BrowserRenderSource,
} from "@groxbot/core";
import { z } from "zod";
import { officeAgentTool } from "./bot-office-tools.js";
import { WorkersAIClient } from "./workers-ai-client.js";

export const BROWSER_ACT_DESCRIPTION =
  "Drive a real browser with natural-language steps (Cloudflare Stagehand). Pass url, html, or a path to HTML on this computer, then act. Optional screenshot lands in inbox/render. Do not use for ordinary page reading — use fetch_url.";

export const RENDER_PDF_DESCRIPTION =
  "Render HTML or a public URL to a PDF on this computer (Cloudflare Browser). Pass html, url, or path to an HTML file. Do not use for ordinary page reading — use fetch_url.";

export const RENDER_SCREENSHOT_DESCRIPTION =
  "Capture a PNG screenshot of HTML or a public URL on this computer (Cloudflare Browser). Pass html, url, or path to an HTML file. Do not use for ordinary page reading — use fetch_url.";

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

export const browserActParameters = z.object({
  ...pageSourceFields,
  act: z
    .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
    .describe("Natural-language step(s) to perform in the browser."),
  screenshot: z
    .boolean()
    .optional()
    .describe("If true, save a PNG under inbox/render (or out)."),
});

export const renderPdfParameters = z.object(pageSourceFields);
export const renderScreenshotParameters = z.object(pageSourceFields);

export type BrowserToolsOpts = {
  browser: BrowserQuickAction;
  workspace: BrowserRenderDisk;
  ai?: {
    run(
      model: string,
      inputs: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
  };
};

export async function runRenderPdfTool(
  opts: Pick<BrowserToolsOpts, "browser" | "workspace">,
  input: BrowserRenderSource,
) {
  return runBrowserQuickAction(opts.browser, opts.workspace, "pdf", input);
}

export async function runRenderScreenshotTool(
  opts: Pick<BrowserToolsOpts, "browser" | "workspace">,
  input: BrowserRenderSource,
) {
  return runBrowserQuickAction(
    opts.browser,
    opts.workspace,
    "screenshot",
    input,
  );
}

export async function runBrowserActTool(
  opts: BrowserToolsOpts,
  input: {
    html?: string;
    url?: string;
    path?: string;
    act: string | string[];
    screenshot?: boolean;
    out?: string;
  },
): Promise<unknown> {
  if (!opts.ai) {
    return { ok: false, message: "Workers AI is not configured for browser_act." };
  }
  const page = await resolveBrowserPage(opts.workspace, input);
  if (!page.ok) return page;

  const acts = Array.isArray(input.act) ? input.act : [input.act];
  const stagehand = new Stagehand({
    env: "LOCAL",
    localBrowserLaunchOptions: {
      cdpUrl: endpointURLString(opts.browser as never),
    },
    llmClient: new WorkersAIClient(opts.ai) as never,
    verbose: 0,
  });

  try {
    await stagehand.init();
    const browserPage = stagehand.page;
    if (page.html != null) {
      await browserPage.setContent(page.html, { waitUntil: "domcontentloaded" });
    } else if (page.url) {
      await browserPage.goto(page.url, { waitUntil: "domcontentloaded" });
    }

    const done: string[] = [];
    for (const step of acts) {
      await browserPage.act(step);
      done.push(step);
    }

    let screenshotPath: string | undefined;
    if (input.screenshot) {
      const out = browserRenderOutPath("screenshot", input.out);
      if (typeof out === "object") {
        return { ok: false, message: out.error, acts: done };
      }
      const buf = await browserPage.screenshot({ type: "png", fullPage: true });
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      const writeErr = await writeBrowserRenderBytes(
        opts.workspace,
        out,
        bytes,
      );
      if (writeErr) return { ...writeErr, acts: done };
      screenshotPath = out;
    }

    return {
      ok: true,
      acts: done,
      ...(screenshotPath
        ? { path: screenshotPath, mediaType: "image/png" }
        : {}),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "browser_act failed.",
    };
  } finally {
    try {
      await stagehand.close();
    } catch {
      /* ignore close errors */
    }
  }
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
  const tools: AgentTool[] = [
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
      execute: async (input) =>
        runRenderScreenshotTool(opts, sourceFromInput(input)),
    }),
  ];
  if (opts.ai) {
    tools.unshift(
      officeAgentTool({
        name: "browser_act",
        description: BROWSER_ACT_DESCRIPTION,
        parameters: browserActParameters,
        execute: async (input) => {
          const act = input.act;
          if (typeof act !== "string" && !Array.isArray(act)) {
            return { ok: false, message: "act is required." };
          }
          return runBrowserActTool(opts, {
            ...sourceFromInput(input),
            act: act as string | string[],
            screenshot: input.screenshot === true,
          });
        },
      }),
    );
  }
  return tools;
}
