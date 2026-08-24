/** Cloudflare-only. Excluded from `tsc`. Source + document state for one workspace app. */
import { DurableObject } from "cloudflare:workers";
import type { AppStore } from "@groxbot/adapter-kit";
import { filesForTemplate, initialState } from "@groxbot/app-runtime";
import type { TemplateId } from "@groxbot/contracts";

export class AppRuntime extends DurableObject {
  async init(templateId: string): Promise<void> {
    const files = filesForTemplate(templateId);
    await this.ctx.storage.put("files", files);
    await this.ctx.storage.put("templateId", templateId);
    await this.ctx.storage.put("codeVersion", 1);
    await this.ctx.storage.put("state", initialState(templateId as TemplateId));
  }

  async uiBundle(): Promise<{ jsCode: string } | null> {
    const files = await this.ctx.storage.get<{ "client.js"?: string }>("files");
    const jsCode = files?.["client.js"];
    return jsCode ? { jsCode } : null;
  }

  async call(method: string, args: unknown[]): Promise<unknown> {
    if (method === "load") {
      return (await this.ctx.storage.get("state")) ?? null;
    }
    if (method === "save") {
      await this.ctx.storage.put("state", args[0]);
      return args[0];
    }
    throw new Error(`Unknown app method: ${method}`);
  }
}

type AppNamespace = {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): {
    init(templateId: string): Promise<void>;
    uiBundle(): Promise<{ jsCode: string } | null>;
    call(method: string, args: unknown[]): Promise<unknown>;
  };
};

export class DurableObjectAppStore implements AppStore {
  constructor(private readonly ns: AppNamespace) {}

  private stub(appId: string) {
    return this.ns.get(this.ns.idFromName(appId));
  }

  init(appId: string, templateId: string): Promise<void> {
    return this.stub(appId).init(templateId);
  }

  uiBundle(appId: string): Promise<{ jsCode: string } | null> {
    return this.stub(appId).uiBundle();
  }

  call(appId: string, method: string, args: unknown[]): Promise<unknown> {
    return this.stub(appId).call(method, args);
  }
}
