/** Cloudflare-only. Excluded from `tsc`. Supervisor for one workspace app. */
import { DurableObject } from "cloudflare:workers";
import { filesForTemplate, initialState } from "@groxbot/app-runtime";
import type { TemplateId } from "@groxbot/contracts";
import { applyAppTitle } from "@groxbot/core";
import { newWorkersRpcResponse, RpcTarget } from "capnweb";

export const APP_WORKSPACE_HEADER = "x-groxbot-workspace";

type LoaderWorker = {
  getDurableObjectClass(name: string): unknown;
};

type WorkerLoader = {
  get(
    name: string,
    getCode: () => Promise<{
      compatibilityDate: string;
      compatibilityFlags?: string[];
      mainModule: string;
      modules: Record<string, string>;
      globalOutbound: null;
    }>,
  ): LoaderWorker;
};

type FacetState = {
  facets: {
    get(
      name: string,
      create: () => { class: unknown; id?: string },
    ): GadgetFacet;
  };
};

type GadgetFacet = {
  getDocument(): Promise<Record<string, unknown>>;
  getDeck(): Promise<Record<string, unknown>>;
  setDeck(deck: unknown): Promise<void>;
  initializeBlocks(args: unknown): Promise<unknown>;
  applyOperation(operation: unknown): Promise<unknown>;
  [key: string]: unknown;
};

type AppRuntimeEnv = {
  LOADER: WorkerLoader;
};

/** Browser-facing host. Do not expose init on this object. */
class AppHost extends RpcTarget {
  constructor(private readonly runtime: AppRuntime) {
    super();
  }

  getUiBundle(): Promise<{ jsCode: string } | null> {
    return this.runtime.uiBundle();
  }

  connectToGadget(): RpcTarget {
    return this.runtime.gadgetTarget();
  }
}

export class AppRuntime extends DurableObject<AppRuntimeEnv> {
  async init(
    templateId: string,
    opts: { workspaceId: string; title: string },
  ): Promise<void> {
    const files = filesForTemplate(templateId);
    await this.ctx.storage.put("files", files);
    await this.ctx.storage.put("templateId", templateId);
    await this.ctx.storage.put("workspaceId", opts.workspaceId);
    await this.ctx.storage.put("codeVersion", 1);
    const titled = applyAppTitle(
      templateId as TemplateId,
      initialState(templateId as TemplateId),
      opts.title,
    );
    await this.hydrate(this.gadgetFacet(), titled);
  }

  async uiBundle(): Promise<{ jsCode: string } | null> {
    const files = await this.ctx.storage.get<{ "client.js"?: string }>("files");
    const jsCode = files?.["client.js"];
    return jsCode ? { jsCode } : null;
  }

  gadgetTarget(): RpcTarget {
    const facet = this.gadgetFacet();
    return new Proxy(new RpcTarget(), {
      get(target, prop, receiver) {
        if (typeof prop === "symbol" || prop in target) {
          return Reflect.get(target, prop, receiver);
        }
        const method = (facet as GadgetFacet)[String(prop)];
        if (typeof method !== "function") return method;
        return (...args: unknown[]) => Reflect.apply(method, facet, args);
      },
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const claimed = request.headers.get(APP_WORKSPACE_HEADER);
    const workspaceId = await this.ctx.storage.get<string>("workspaceId");
    if (!workspaceId || claimed !== workspaceId) {
      return new Response("Forbidden", { status: 403 });
    }
    return newWorkersRpcResponse(request, new AppHost(this));
  }

  private gadgetFacet(): GadgetFacet {
    const facets = (this.ctx as DurableObjectState & FacetState).facets;
    return facets.get("gadget", () => {
      const worker = this.loadWorker();
      return {
        class: worker.getDurableObjectClass("Gadget"),
        id: "gadget",
      };
    });
  }

  private loadWorker(): LoaderWorker {
    const loader = this.env.LOADER;
    return loader.get(`app:${this.ctx.id.toString()}`, async () => {
      const files = await this.ctx.storage.get<{
        "client.js"?: string;
        "server.js"?: string;
      }>("files");
      const server = files?.["server.js"];
      if (!server) throw new Error("App has no server.js");
      return {
        compatibilityDate: "2026-08-16",
        mainModule: "server.js",
        modules: {
          "server.js": server,
          "client.js": files?.["client.js"] ?? "",
        },
        globalOutbound: null,
      };
    });
  }

  private async hydrate(facet: GadgetFacet, state: unknown): Promise<void> {
    if (!state || typeof state !== "object") return;
    const templateId = await this.ctx.storage.get<string>("templateId");
    const rec = state as Record<string, unknown>;
    if (templateId === "slides") {
      await facet.setDeck(state);
      return;
    }
    if (templateId === "sheets") {
      const doc = await facet.getDocument();
      const sheetId = String(
        Array.isArray(doc.sheetOrder) ? doc.sheetOrder[0] : "",
      );
      if (
        rec.cells &&
        typeof rec.cells === "object" &&
        !rec.sheetOrder &&
        sheetId
      ) {
        const cellOps = Object.entries(
          rec.cells as Record<string, unknown>,
        ).map(([ref, value]) => ({
          sheetId,
          ref,
          value:
            value != null && typeof value === "object" && "value" in value
              ? String((value as { value: unknown }).value ?? "")
              : String(value ?? ""),
          baseVersion: 0,
        }));
        await facet.applyOperation({ senderId: "system", cellOps });
      }
      if (typeof rec.title === "string") {
        await facet.applyOperation({
          senderId: "system",
          structure: {
            title: rec.title,
            sheetOrder: doc.sheetOrder,
            sheets: doc.sheets,
          },
        });
      }
      return;
    }
    await facet.initializeBlocks({
      blocks: Array.isArray(rec.blocks) ? rec.blocks : [],
      title: typeof rec.title === "string" ? rec.title : "Untitled",
      senderId: "system",
    });
  }
}

type AppNamespace = {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): {
    init(
      templateId: string,
      opts: { workspaceId: string; title: string },
    ): Promise<void>;
    fetch(request: Request): Promise<Response>;
  };
};

export class DurableObjectAppStore {
  constructor(private readonly ns: AppNamespace) {}

  private stub(appId: string) {
    return this.ns.get(this.ns.idFromName(appId));
  }

  init(
    appId: string,
    templateId: string,
    opts: { workspaceId: string; title: string },
  ): Promise<void> {
    return this.stub(appId).init(templateId, opts);
  }

  connect(
    appId: string,
    request: Request,
    workspaceId: string,
  ): Promise<Response> {
    const headers = new Headers(request.headers);
    headers.set(APP_WORKSPACE_HEADER, workspaceId);
    return this.stub(appId).fetch(new Request(request, { headers }));
  }
}
