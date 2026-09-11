import { OFFICE_STAMP_APP_TOOL_NAME } from "@groxbot/core";
import { describe, expect, it, vi } from "vitest";
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
    expect(initApp).toHaveBeenCalledWith(expect.any(String), "crm", {
      workspaceId: "ws_1",
      title: "Acme",
    });
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

  it("rejects invalid custom JavaScript before initializing an app", async () => {
    const initApp = vi.fn(async () => undefined);
    const tool = createStampAppTool({
      workspaceId: () => "ws_1",
      initApp,
      recordCard: async () => undefined,
    });

    await expect(
      tool.execute("call_3", {
        title: "Broken",
        clientJs: "const broken = ;",
        serverJs: GADGET_SERVER,
      }),
    ).rejects.toThrow(/client\.js is not valid JavaScript/);
    expect(initApp).not.toHaveBeenCalled();
  });

  it("does not publish a card when runtime validation fails", async () => {
    const recordCard = vi.fn(async () => undefined);
    const tool = createStampAppTool({
      workspaceId: () => "ws_1",
      initApp: async () => {
        throw new Error("Custom app could not load: missing import");
      },
      recordCard,
    });

    await expect(
      tool.execute("call_4", {
        title: "Broken",
        clientJs: GADGET_CLIENT,
        serverJs: GADGET_SERVER,
      }),
    ).rejects.toThrow(/Custom app could not load/);
    expect(recordCard).not.toHaveBeenCalled();
  });
});
