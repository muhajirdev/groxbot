import type { AppStore } from "@groxbot/adapter-kit";
import type { TemplateId } from "@groxbot/contracts";
import { docsClientJs } from "./docs.client.js";
import { initialState } from "./initial-state.js";
import { APP_SERVER_JS } from "./server-js.js";
import { sheetsClientJs } from "./sheets.client.js";
import { slidesClientJs } from "./slides.client.js";

export { initialState } from "./initial-state.js";
export { APP_SERVER_JS } from "./server-js.js";
export { evalSheet } from "./sheets-engine.js";

export const APP_TEMPLATES = {
  docs: {
    clientJs: docsClientJs,
    serverJs: APP_SERVER_JS,
    title: "Untitled doc",
  },
  slides: {
    clientJs: slidesClientJs,
    serverJs: APP_SERVER_JS,
    title: "Untitled slides",
  },
  sheets: {
    clientJs: sheetsClientJs,
    serverJs: APP_SERVER_JS,
    title: "Untitled sheet",
  },
} as const;

export type AppTemplateId = keyof typeof APP_TEMPLATES;

export function filesForTemplate(templateId: string): {
  "client.js": string;
  "server.js": string;
} {
  const t = APP_TEMPLATES[templateId as AppTemplateId];
  if (!t) throw new Error(`Unknown app template: ${templateId}`);
  return { "client.js": t.clientJs, "server.js": t.serverJs };
}

type AppRecord = {
  files: Record<string, string>;
  state: unknown;
};

export class MemoryAppStore implements AppStore {
  private readonly apps = new Map<string, AppRecord>();

  async init(appId: string, templateId: string): Promise<void> {
    const files = filesForTemplate(templateId);
    this.apps.set(appId, {
      files: { ...files },
      state: structuredClone(initialState(templateId as TemplateId)),
    });
  }

  async uiBundle(appId: string): Promise<{ jsCode: string } | null> {
    const rec = this.apps.get(appId);
    const jsCode = rec?.files["client.js"];
    if (!jsCode) return null;
    return { jsCode };
  }

  async call(appId: string, method: string, args: unknown[]): Promise<unknown> {
    const rec = this.apps.get(appId);
    if (!rec) throw new Error("App not found");
    if (method === "load") return rec.state;
    if (method === "save") {
      rec.state = args[0];
      return rec.state;
    }
    throw new Error(`Unknown app method: ${method}`);
  }
}
