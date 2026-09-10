export const GADGET_FILE_MAX_CHARS = 200_000;

export type GadgetFiles = {
  "client.js": string;
  "server.js": string;
};

export class GadgetFilesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GadgetFilesError";
  }
}

/** Custom gadget sources. Built-in templates do not use this. */
export function parseGadgetFiles(input: {
  clientJs?: unknown;
  serverJs?: unknown;
}): GadgetFiles {
  const clientJs = typeof input.clientJs === "string" ? input.clientJs : "";
  const serverJs = typeof input.serverJs === "string" ? input.serverJs : "";
  if (!clientJs.trim() || !serverJs.trim()) {
    throw new GadgetFilesError(
      "A custom app needs clientJs and serverJs. server.js must export class Gadget.",
    );
  }
  if (
    clientJs.length > GADGET_FILE_MAX_CHARS ||
    serverJs.length > GADGET_FILE_MAX_CHARS
  ) {
    throw new GadgetFilesError("That gadget is too large.");
  }
  if (!/\bexport\s+class\s+Gadget\b/.test(serverJs)) {
    throw new GadgetFilesError("server.js must `export class Gadget`.");
  }
  return { "client.js": clientJs, "server.js": serverJs };
}
