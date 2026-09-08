import { describe, expect, it, vi } from "vitest";
import {
  browserRenderOutPath,
  resolveBrowserPage,
  runBrowserQuickAction,
} from "./browser-render.js";

describe("browser-render", () => {
  it("resolves html, url, or path", async () => {
    const workspace = {
      readFile: vi.fn(async (path: string) =>
        path === "draft.html" ? "<h1>hi</h1>" : null,
      ),
    };
    await expect(
      resolveBrowserPage(workspace, { html: "<p>x</p>" }),
    ).resolves.toEqual({ ok: true, html: "<p>x</p>" });
    await expect(
      resolveBrowserPage(workspace, { url: "https://example.com/" }),
    ).resolves.toEqual({ ok: true, url: "https://example.com/" });
    await expect(
      resolveBrowserPage(workspace, { html: "", path: "draft.html" }),
    ).resolves.toEqual({ ok: true, html: "<h1>hi</h1>" });
    await expect(resolveBrowserPage(workspace, {})).resolves.toMatchObject({
      ok: false,
    });
  });

  it("defaults out under inbox/render", () => {
    expect(browserRenderOutPath("pdf")).toMatch(/^inbox\/render\/.+\.pdf$/);
    expect(browserRenderOutPath("screenshot", "out/a.png")).toBe("out/a.png");
  });

  it("writes quickAction bytes to the computer", async () => {
    const writes: Array<{ path: string; bytes: Uint8Array }> = [];
    const workspace = {
      readFile: async () => null,
      writeFileBytes: async (path: string, content: Uint8Array) => {
        writes.push({ path, bytes: content });
      },
      mkdir: async () => {},
    };
    const browser = {
      quickAction: vi.fn(async () =>
        new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
      ),
    };
    const result = await runBrowserQuickAction(browser, workspace, "pdf", {
      html: "<html></html>",
      out: "inbox/render/doc.pdf",
    });
    expect(result).toEqual({
      ok: true,
      path: "inbox/render/doc.pdf",
      bytes: 3,
      mediaType: "application/pdf",
    });
    expect(writes[0]?.path).toBe("inbox/render/doc.pdf");
    expect(browser.quickAction).toHaveBeenCalledWith("pdf", {
      html: "<html></html>",
    });
  });
});
