import { describe, expect, it } from "vitest";
import { newId } from "./ids";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  it("returns a unique UUID even without a crypto global", () => {
    const first = newId();
    const second = newId();
    expect(first).toMatch(UUID_V4);
    expect(second).toMatch(UUID_V4);
    expect(first).not.toBe(second);
  });
});
