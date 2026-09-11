import { describe, expect, it } from "vitest";
import {
  clampPaneWidth,
  PANE_WIDTH_DEFAULT,
  PANE_WIDTH_MAX,
  PANE_WIDTH_MIN,
} from "./pane-width";
import {
  clampSideWidth,
  clampSideWidthLive,
  isSideRail,
  SIDE_WIDTH_DEFAULT,
  SIDE_WIDTH_MAX,
  SIDE_WIDTH_MIN,
  SIDE_WIDTH_RAIL,
} from "./side-width";

describe("clampSideWidth", () => {
  it("keeps a width inside the named roster range", () => {
    expect(SIDE_WIDTH_DEFAULT).toBe(240);
    expect(clampSideWidth(240)).toBe(240);
    expect(clampSideWidth(SIDE_WIDTH_MIN)).toBe(SIDE_WIDTH_MIN);
    expect(clampSideWidth(SIDE_WIDTH_MAX)).toBe(SIDE_WIDTH_MAX);
  });

  it("lets a live drag pass through the snap gap", () => {
    expect(clampSideWidthLive(140)).toBe(140);
    expect(clampSideWidth(140)).toBe(SIDE_WIDTH_RAIL);
  });

  it("snaps below the named floor to the icon rail", () => {
    expect(clampSideWidth(SIDE_WIDTH_MIN - 1)).toBe(SIDE_WIDTH_RAIL);
    expect(clampSideWidth(80)).toBe(SIDE_WIDTH_RAIL);
    expect(isSideRail(SIDE_WIDTH_RAIL)).toBe(true);
    expect(isSideRail(SIDE_WIDTH_MIN - 1)).toBe(true);
    expect(isSideRail(SIDE_WIDTH_MIN)).toBe(false);
  });

  it("clips and ignores junk", () => {
    expect(clampSideWidth(900)).toBe(SIDE_WIDTH_MAX);
    expect(clampSideWidth(Number.NaN)).toBe(SIDE_WIDTH_DEFAULT);
  });
});

describe("clampPaneWidth", () => {
  it("defaults a hair wider than the old 360 peek", () => {
    expect(PANE_WIDTH_DEFAULT).toBe(380);
    expect(clampPaneWidth(380)).toBe(380);
    expect(clampPaneWidth(PANE_WIDTH_MIN)).toBe(PANE_WIDTH_MIN);
    expect(clampPaneWidth(PANE_WIDTH_MAX)).toBe(PANE_WIDTH_MAX);
  });

  it("clips and ignores junk", () => {
    expect(clampPaneWidth(80)).toBe(PANE_WIDTH_MIN);
    expect(clampPaneWidth(900)).toBe(PANE_WIDTH_MAX);
    expect(clampPaneWidth(Number.NaN)).toBe(PANE_WIDTH_DEFAULT);
  });
});
