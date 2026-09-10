import { describe, expect, it } from "vitest";
import { parseGadgetFiles } from "./gadget-files.js";

describe("parseGadgetFiles", () => {
  const serverJs = `import { DurableObject } from "cloudflare:workers";
export class Gadget extends DurableObject {
  ping() { return "ok"; }
}`;
  const clientJs = `document.body.textContent = "Hi";`;

  it("accepts a Gadget export", () => {
    expect(parseGadgetFiles({ clientJs, serverJs })).toEqual({
      "client.js": clientJs,
      "server.js": serverJs,
    });
  });

  it("rejects missing files or a missing Gadget class", () => {
    expect(() => parseGadgetFiles({ clientJs })).toThrow(/clientJs and serverJs/);
    expect(() =>
      parseGadgetFiles({ clientJs, serverJs: "export class Foo {}" }),
    ).toThrow(/export class Gadget/);
  });
});
