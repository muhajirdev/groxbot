import { describe, expect, it } from "vitest";
import {
  botVisibleToViewer,
  mcpBindableForBot,
  mcpVisibleToViewer,
  parseVisibility,
} from "./visibility.js";

const alice = "user-alice";
const bob = "user-bob";

describe("visibility", () => {
  it("treats unknown values as shared so existing rows stay the office default", () => {
    expect(parseVisibility("shared")).toBe("shared");
    expect(parseVisibility("private")).toBe("private");
    expect(parseVisibility("")).toBe("shared");
    expect(parseVisibility(undefined)).toBe("shared");
  });

  it("shows a private teammate only to the owner", () => {
    const inbox = { visibility: "private", userId: alice };
    expect(botVisibleToViewer(inbox, alice)).toBe(true);
    expect(botVisibleToViewer(inbox, bob)).toBe(false);
    expect(
      botVisibleToViewer({ visibility: "shared", userId: alice }, bob),
    ).toBe(true);
  });

  it("shows a private MCP only to the owner", () => {
    const gmail = { visibility: "private", userId: alice };
    expect(mcpVisibleToViewer(gmail, alice)).toBe(true);
    expect(mcpVisibleToViewer(gmail, bob)).toBe(false);
  });

  it("lets a private bot use the owner’s private MCP and office MCP", () => {
    const inbox = { visibility: "private", userId: alice };
    expect(
      mcpBindableForBot({ visibility: "private", userId: alice }, inbox),
    ).toBe(true);
    expect(
      mcpBindableForBot({ visibility: "shared", userId: bob }, inbox),
    ).toBe(true);
    expect(
      mcpBindableForBot({ visibility: "private", userId: bob }, inbox),
    ).toBe(false);
  });

  it("lets a shared bot use office MCP only", () => {
    const tutor = { visibility: "shared", userId: alice };
    expect(
      mcpBindableForBot({ visibility: "shared", userId: alice }, tutor),
    ).toBe(true);
    expect(
      mcpBindableForBot({ visibility: "private", userId: alice }, tutor),
    ).toBe(false);
  });
});
