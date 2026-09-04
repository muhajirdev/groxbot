/** Cloudflare-only. Bundles npm imports before Code Mode execute. */
import {
  createCodemodeRuntime,
  DynamicWorkerExecutor,
  type CodemodeConnector,
  type Executor,
  type ExecuteOptions,
  type ExecuteResult,
  type ResolvedProvider,
} from "@cloudflare/codemode";
import { toolSetConnector } from "@cloudflare/codemode/ai";
import { createWorker } from "@cloudflare/worker-bundler";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { splitExecuteNpmImports } from "@groxbot/core";
import { tool, type ToolSet } from "ai";
import {
  FETCH_URL_DESCRIPTION,
  fetchUrlParameters,
  type PageWorkspace,
  runFetchUrlTool,
  runToMarkdownTool,
  TO_MARKDOWN_DESCRIPTION,
  toMarkdownParameters,
} from "./bot-markdown.js";
import { aiToolToPi } from "./bot-office-tools.js";

type LoaderWorker = {
  getEntrypoint: () => {
    evaluate: (...args: unknown[]) => Promise<unknown>;
    [Symbol.dispose]?: () => void;
  };
  [Symbol.dispose]?: () => void;
};

type WorkerLoaderLike = {
  load: (opts: Record<string, unknown>) => LoaderWorker;
};

type BundleJob = {
  importSource: string;
  dependencies: Record<string, string>;
};

function disposeQuietly(value: unknown): void {
  try {
    const dispose = (value as { [Symbol.dispose]?: () => void })?.[
      Symbol.dispose
    ];
    dispose?.call(value);
  } catch {
    /* isolate already gone */
  }
}

function bundlingLoader(loader: WorkerLoaderLike): {
  load: WorkerLoaderLike["load"];
  setJob: (next: BundleJob | null) => void;
} {
  let job: BundleJob | null = null;
  return {
    setJob(next) {
      job = next;
    },
    load(opts) {
      const pending = job;
      job = null;
      if (!pending || Object.keys(pending.dependencies).length === 0) {
        return loader.load(opts);
      }
      let inner: LoaderWorker | undefined;
      const ensure = async () => {
        if (inner) return inner;
        const modules = (opts.modules ?? {}) as Record<string, string>;
        const executor = modules["executor.js"];
        if (typeof executor !== "string") {
          throw new Error("execute bundle: missing executor.js");
        }
        const source = pending.importSource
          ? `${pending.importSource}\n${executor}`
          : executor;
        const bundled = await createWorker({
          files: {
            "executor.js": source,
            "package.json": JSON.stringify({
              type: "module",
              dependencies: pending.dependencies,
            }),
          },
          entryPoint: "executor.js",
          bundle: true,
          minify: false,
        });
        inner = loader.load({
          ...opts,
          mainModule: bundled.mainModule,
          modules: bundled.modules,
        });
        return inner;
      };
      return {
        getEntrypoint() {
          return {
            async evaluate(...args: unknown[]) {
              const worker = await ensure();
              return worker.getEntrypoint().evaluate(...args);
            },
            [Symbol.dispose]() {
              if (inner) disposeQuietly(inner.getEntrypoint());
            },
          };
        },
        [Symbol.dispose]() {
          disposeQuietly(inner);
        },
      };
    },
  };
}

export function createBundlingExecutor(
  loader: unknown,
  options?: { timeout?: number; globalOutbound?: Fetcher | null },
): Executor {
  const wrapped = bundlingLoader(loader as WorkerLoaderLike);
  const inner = new DynamicWorkerExecutor({
    loader: wrapped as never,
    timeout: options?.timeout,
    globalOutbound: options?.globalOutbound ?? null,
  });
  return {
    async execute(
      code: string,
      providersOrFns:
        | ResolvedProvider[]
        | Record<string, (...args: unknown[]) => Promise<unknown>>,
      executeOptions?: ExecuteOptions,
    ): Promise<ExecuteResult> {
      const split = splitExecuteNpmImports(String(code ?? ""));
      wrapped.setJob(
        Object.keys(split.dependencies).length > 0
          ? {
              importSource: split.importSource,
              dependencies: split.dependencies,
            }
          : null,
      );
      try {
        return await inner.execute(split.body, providersOrFns, executeOptions);
      } catch (error) {
        return {
          result: undefined,
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        wrapped.setJob(null);
      }
    },
  };
}

/** Code Mode page tools. The Pi loop sees fetch_url / to_markdown as sibling AgentTools. */
function pageToolSet(page: {
  workspace: PageWorkspace;
  convert?: Parameters<typeof runToMarkdownTool>[0]["convert"];
}): ToolSet {
  return {
    fetch_url: tool({
      description: FETCH_URL_DESCRIPTION,
      inputSchema: fetchUrlParameters,
      execute: async ({ url }) => runFetchUrlTool(page.workspace, url),
    }),
    to_markdown: tool({
      description: TO_MARKDOWN_DESCRIPTION,
      inputSchema: toMarkdownParameters,
      execute: async (input) => runToMarkdownTool(page, input),
    }),
  };
}

/** Code Mode execute — office connectors only. Files and bash are Computer tools. */
export function createOfficeExecuteTool(opts: {
  ctx: DurableObjectState;
  executor: Executor;
  page?: {
    workspace: PageWorkspace;
    convert?: Parameters<typeof runToMarkdownTool>[0]["convert"];
  };
  connectors?: CodemodeConnector[];
  name?: string;
}): AgentTool {
  const connectors: CodemodeConnector[] = [];
  if (opts.page) {
    connectors.push(
      toolSetConnector(opts.ctx, {
        name: "tools",
        tools: pageToolSet(opts.page),
      }),
    );
  }
  if (opts.connectors) connectors.push(...opts.connectors);
  const runtime = createCodemodeRuntime({
    ctx: opts.ctx,
    executor: opts.executor,
    connectors,
    name: opts.name ?? "execute",
  });
  const wrapped = aiToolToPi("execute", runtime.tool());
  if (!wrapped) throw new Error("Code Mode execute tool is missing execute()");
  return wrapped;
}
