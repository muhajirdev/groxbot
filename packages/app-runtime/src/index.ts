import { crmClientJs } from "./generated/crm.client.js";
import { crmServerJs } from "./generated/crm.server.js";
import { docsClientJs } from "./generated/docs.client.js";
import { docsServerJs } from "./generated/docs.server.js";
import { gameClientJs } from "./generated/game.client.js";
import { gameServerJs } from "./generated/game.server.js";
import { sheetsClientJs } from "./generated/sheets.client.js";
import { sheetsServerJs } from "./generated/sheets.server.js";
import { slidesClientJs } from "./generated/slides.client.js";
import { slidesServerJs } from "./generated/slides.server.js";

export { initialState } from "./initial-state.js";
export { evalSheet } from "./sheets-engine.js";

export const APP_TEMPLATES = {
  docs: {
    clientJs: docsClientJs,
    serverJs: docsServerJs,
    title: "Untitled doc",
  },
  slides: {
    clientJs: slidesClientJs,
    serverJs: slidesServerJs,
    title: "Untitled slides",
  },
  sheets: {
    clientJs: sheetsClientJs,
    serverJs: sheetsServerJs,
    title: "Untitled sheet",
  },
  crm: {
    clientJs: crmClientJs,
    serverJs: crmServerJs,
    title: "Untitled CRM",
  },
  game: {
    clientJs: gameClientJs,
    serverJs: gameServerJs,
    title: "Tic-tac-toe",
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

/** Node/test stand-in. Hosted apps use AppRuntime + a Gadget facet. */
export class MemoryAppStore {
  private readonly apps = new Set<string>();

  async init(
    appId: string,
    templateId: string,
    _opts: { workspaceId: string; title: string },
  ): Promise<void> {
    filesForTemplate(templateId);
    this.apps.add(appId);
  }
}
