import { describe, expect, it, vi } from "vitest";
import { appWorkerCode, validateAppWorker } from "./app-runtime-code.js";

const files = {
  "client.js": "document.body.textContent = 'Hello';",
  "server.js": "export class Gadget {}",
};

describe("appWorkerCode", () => {
  it("loads both custom modules without outbound access", () => {
    expect(appWorkerCode(files)).toEqual({
      compatibilityDate: "2026-07-28",
      mainModule: "server.js",
      modules: files,
      globalOutbound: null,
    });
  });

  it("resolves Gadget through the uncached loader before publish", () => {
    const getDurableObjectClass = vi.fn(() => ({}));
    const load = vi.fn(() => ({ getDurableObjectClass }));

    validateAppWorker(
      {
        load,
        get: vi.fn(() => ({ getDurableObjectClass })),
      },
      files,
    );

    expect(load).toHaveBeenCalledWith(appWorkerCode(files));
    expect(getDurableObjectClass).toHaveBeenCalledWith("Gadget");
  });

  it("surfaces loader compilation errors", () => {
    const error = new Error("Unexpected token in client.js");
    expect(() =>
      validateAppWorker(
        {
          load: () => {
            throw error;
          },
          get: vi.fn(),
        },
        files,
      ),
    ).toThrow(/Custom app could not load: Unexpected token in client\.js/);
  });
});
