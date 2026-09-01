/** Cloudflare-only. Bundles npm imports before Code Mode execute. */
import {
  DynamicWorkerExecutor,
  type Executor,
  type ExecuteOptions,
  type ExecuteResult,
  type ResolvedProvider,
} from "@cloudflare/codemode";
import { createWorker } from "@cloudflare/worker-bundler";
import { splitExecuteNpmImports } from "@groxbot/core";

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
