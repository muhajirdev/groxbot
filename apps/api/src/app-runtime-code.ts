export type AppSourceFiles = {
  "client.js": string;
  "server.js": string;
};

export type AppWorkerCode = {
  compatibilityDate: string;
  mainModule: string;
  modules: Record<string, string>;
  globalOutbound: null;
};

type LoadedWorker = {
  getDurableObjectClass(name: string): unknown;
};

export type AppWorkerLoader = {
  get(name: string, getCode: () => Promise<AppWorkerCode>): LoadedWorker;
  load(code: AppWorkerCode): LoadedWorker;
};

export function appWorkerCode(files: AppSourceFiles): AppWorkerCode {
  return {
    compatibilityDate: "2026-07-28",
    mainModule: "server.js",
    modules: {
      "server.js": files["server.js"],
      "client.js": files["client.js"],
    },
    globalOutbound: null,
  };
}

/** Compile both modules and resolve the required actor before publishing it. */
export function validateAppWorker(
  loader: AppWorkerLoader,
  files: AppSourceFiles,
): void {
  try {
    loader.load(appWorkerCode(files)).getDurableObjectClass("Gadget");
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error";
    throw new Error(`Custom app could not load: ${message}`, { cause: caught });
  }
}
