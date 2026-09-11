/** Cloudflare-only. Excluded from `tsc`. Model stamps a live workspace app. */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { InitApp } from "@groxbot/adapter-kit";
import { BuiltinTemplateId, type TemplateId } from "@groxbot/contracts";
import {
  GADGET_FILE_MAX_CHARS,
  GadgetFilesError,
  OFFICE_STAMP_APP_DESCRIPTION,
  OFFICE_STAMP_APP_TOOL_NAME,
  officeStampAppTitle,
  parseGadgetFiles,
  stampApp,
} from "@groxbot/core";
import { parse } from "acorn";
import { z } from "zod";
import { officeAgentTool } from "./bot-office-tools.js";

function validateJavaScript(name: string, source: string): void {
  try {
    parse(source, { ecmaVersion: "latest", sourceType: "module" });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Syntax error";
    throw new GadgetFilesError(`${name} is not valid JavaScript: ${message}`);
  }
}

export function createStampAppTool(opts: {
  workspaceId: () => string;
  initApp: InitApp;
  recordCard: (app: {
    id: string;
    templateId: TemplateId;
    title: string;
  }) => Promise<void>;
}): AgentTool {
  return officeAgentTool({
    name: OFFICE_STAMP_APP_TOOL_NAME,
    description: OFFICE_STAMP_APP_DESCRIPTION,
    parameters: z.object({
      title: z.string().max(80).optional(),
      templateId: BuiltinTemplateId.optional(),
      clientJs: z.string().max(GADGET_FILE_MAX_CHARS).optional(),
      serverJs: z.string().max(GADGET_FILE_MAX_CHARS).optional(),
    }),
    execute: async ({ templateId, title, clientJs, serverJs }) => {
      const workspaceId = opts.workspaceId().trim();
      if (!workspaceId) throw new Error("This room is not ready yet.");
      const wantsCustom =
        (typeof clientJs === "string" && Boolean(clientJs.trim())) ||
        (typeof serverJs === "string" && Boolean(serverJs.trim()));
      const files = wantsCustom
        ? parseGadgetFiles({ clientJs, serverJs })
        : undefined;
      if (files) {
        validateJavaScript("client.js", files["client.js"]);
        validateJavaScript("server.js", files["server.js"]);
      }
      const builtin = BuiltinTemplateId.safeParse(templateId);
      let parsed: TemplateId;
      if (files) {
        parsed = "app";
      } else if (builtin.success) {
        parsed = builtin.data;
      } else {
        throw new GadgetFilesError(
          "Pass a built-in templateId (docs, slides, sheets, crm, game) or clientJs and serverJs for a custom gadget.",
        );
      }
      const app = await stampApp({
        initApp: opts.initApp,
        workspaceId,
        templateId: parsed,
        title: officeStampAppTitle(
          parsed,
          typeof title === "string" ? title : "",
        ),
        ...(files ? { files } : {}),
      });
      try {
        await opts.recordCard({
          id: app.id,
          templateId: app.templateId,
          title: app.title,
        });
      } catch (error) {
        console.error("stamp_app record card", error);
      }
      return {
        ok: true,
        appId: app.id,
        templateId: app.templateId,
        title: app.title,
      };
    },
  });
}
