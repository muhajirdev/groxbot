/** Cloudflare-only. Excluded from `tsc`. Model stamps a live workspace app. */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { InitApp } from "@groxbot/adapter-kit";
import { type TemplateId, BuiltinTemplateId } from "@groxbot/contracts";
import {
  GADGET_FILE_MAX_CHARS,
  GadgetFilesError,
  OFFICE_STAMP_APP_DESCRIPTION,
  OFFICE_STAMP_APP_TOOL_NAME,
  officeStampAppTitle,
  parseGadgetFiles,
  stampApp,
} from "@groxbot/core";
import { z } from "zod";
import { officeAgentTool } from "./bot-office-tools.js";

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
      const builtin = BuiltinTemplateId.safeParse(templateId);
      if (!files && !builtin.success) {
        throw new GadgetFilesError(
          "Pass a built-in templateId (docs, slides, sheets, crm, game) or clientJs and serverJs for a custom gadget.",
        );
      }
      const parsed: TemplateId = files ? "app" : builtin.data!;
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
