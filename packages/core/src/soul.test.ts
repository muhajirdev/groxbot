import { describe, expect, it } from "vitest";
import { composeSoul, soulOverlayFromWrite } from "./soul.js";

const BASE = "You are Reja, a Groxbot teammate in this office thread.";

describe("composeSoul", () => {
  it("is just the name identity when nothing has grown yet", () => {
    expect(composeSoul(BASE, "")).toBe(BASE);
    expect(composeSoul(BASE, "  ")).toBe(BASE);
  });

  it("appends the evolved overlay", () => {
    expect(composeSoul(BASE, "Dry. Short. Asks before sending mail.")).toBe(
      `${BASE}\n\nDry. Short. Asks before sending mail.`,
    );
  });

  it("does not duplicate when the write already includes the identity", () => {
    const full = `${BASE}\n\nDry. Short.`;
    expect(composeSoul(BASE, full)).toBe(full);
  });
});

describe("soulOverlayFromWrite", () => {
  it("stores only the grown part after a full-block replace", () => {
    expect(
      soulOverlayFromWrite(BASE, `${BASE}\n\nDry. Short. Asks before mail.`),
    ).toBe("Dry. Short. Asks before mail.");
  });

  it("keeps a replace that does not include the identity prefix", () => {
    expect(soulOverlayFromWrite(BASE, "Dry. Short.")).toBe("Dry. Short.");
  });

  it("clears when the write is only the frozen identity", () => {
    expect(soulOverlayFromWrite(BASE, BASE)).toBe("");
    expect(soulOverlayFromWrite(BASE, "  ")).toBe("");
  });
});
