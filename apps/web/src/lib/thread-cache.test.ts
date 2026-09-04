import { afterEach, describe, expect, it } from "vitest";
import { threadMetaCollection } from "./collections";
import {
  OFFICE_WORKING,
  dropThreadMeta,
  ensureThreadMeta,
  patchThreadMeta,
  readThreadMeta,
} from "./thread-cache";

afterEach(() => {
  const keys = [...threadMetaCollection.keys()];
  if (keys.length > 0) threadMetaCollection.delete(keys);
});

describe("threadMeta", () => {
  it("inserts opening false", () => {
    expect(ensureThreadMeta("bot-1").opening).toBe(false);
    expect(readThreadMeta("bot-1")?.working).toBe("");
  });

  it("patches working and opening", () => {
    patchThreadMeta("bot-1", { opening: true, working: OFFICE_WORKING });
    expect(readThreadMeta("bot-1")).toMatchObject({
      opening: true,
      working: OFFICE_WORKING,
    });
    patchThreadMeta("bot-1", { opening: false, working: "" });
    expect(readThreadMeta("bot-1")).toMatchObject({
      opening: false,
      working: "",
    });
  });

  it("drops a row", () => {
    ensureThreadMeta("bot-1");
    dropThreadMeta("bot-1");
    expect(readThreadMeta("bot-1")).toBeUndefined();
  });
});
