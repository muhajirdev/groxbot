import { describe, expect, it } from "vitest";
import { DOCK_LABELS_HIDE, DockLabelsHiddenContext } from "./icon-press";

describe("dock label rail", () => {
  it("hides captions on the 72px sidebar", () => {
    expect(DOCK_LABELS_HIDE).toBe(
      "(max-width: 960px) and (min-width: 721px)",
    );
    expect(DockLabelsHiddenContext).toBeDefined();
  });
});
