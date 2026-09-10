import { describe, expect, it, vi } from "vitest";
import { OFFICE_STAMP_APP_TOOL_NAME } from "@groxbot/core";
import { createStampAppTool } from "./bot-stamp.js";

const GADGET_SERVER = `import { DurableObject } from "cloudflare:workers";
export class Gadget extends DurableObject {
  ping() { return "ok"; }
}`;
const GADGET_CLIENT = `document.body.textContent = "Hi";`;

describe("createStampAppTool", () => {
  it("stamps the template the model picked", async () => {
    const initApp = vi.fn(async () => undefined);
    const recordCard = vi.fn(async () => undefined);
    const tool = createStampAppTool({
      workspaceId: () => "ws_1",
      initApp,
      recordCard,
    });
    expect(tool.name).toBe(OFFICE_STAMP_APP_TOOL_NAME);
    const result = await tool.execute("call_1", {
      templateId: "crm",
      title: "Acme",
    });
    expect(initApp).toHaveBeenCalledWith(
      expect.any(String),
      "crm",
      { workspaceId: "ws_1", title: "Acme" },
    );
    expect(recordCard).toHaveBeenCalledWith({
      id: expect.any(String),
      templateId: "crm",
      title: "Acme",
    });
    expect(result.details).toMatchObject({
      ok: true,
      templateId: "crm",
      title: "Acme",
    });
  });

  it("stamps a custom gadget from client.js and server.js", async () => {
    const initApp = vi.fn(async () => undefined);
    const recordCard = vi.fn(async () => undefined);
    const tool = createStampAppTool({
      workspaceId: () => "ws_1",
      initApp,
      recordCard,
    });
    const result = await tool.execute("call_2", {
      title: "Todo",
      clientJs: GADGET_CLIENT,
      serverJs: GADGET_SERVER,
    });
    expect(initApp).toHaveBeenCalledWith(expect.any(String), "app", {
      workspaceId: "ws_1",
      title: "Todo",
      files: { "client.js": GADGET_CLIENT, "server.js": GADGET_SERVER },
    });
    expect(recordCard).toHaveBeenCalledWith({
      id: expect.any(String),
      templateId: "app",
      title: "Todo",
    });
    expect(result.details).toMatchObject({
      ok: true,
      templateId: "app",
      title: "Todo",
    });
  });

  it("rejects a template that is not a live app", async () => {
    const tool = createStampAppTool({
      workspaceId: () => "ws_1",
      initApp: async () => undefined,
      recordCard: async () => undefined,
    });
    await expect(
      tool.execute("call_1", { templateId: "calendar" }),
    ).rejects.toThrow(/clientJs and serverJs|templateId/);
  });
});
