import { describe, expect, it } from "vitest";
import {
  composePersonDoorSoul,
  parsePersonDoorContext,
  parsePersonDoorToolSpecs,
  PERSON_DOOR_CONTEXT_PATH,
  PERSON_DOOR_TOOL_PATH,
  PERSON_DOOR_TOOLS_PATH,
} from "./person-door.js";

describe("person door", () => {
  it("names the home HTTP door", () => {
    expect(PERSON_DOOR_CONTEXT_PATH).toBe("/door/context");
    expect(PERSON_DOOR_TOOLS_PATH).toBe("/door/tools");
    expect(PERSON_DOOR_TOOL_PATH).toBe("/door/tool");
  });

  it("composes roster soul, overlay, and memory", () => {
    expect(
      composePersonDoorSoul({
        soulPrompt: "You are Steve.",
        overlay: "Dry. Short.",
        memory: "Board is Friday.",
      }),
    ).toBe("You are Steve.\n\nDry. Short.\n\nMemory:\nBoard is Friday.");
  });

  it("parses context and tool catalogs", () => {
    expect(parsePersonDoorContext({ soulPrompt: "You are Steve." })).toEqual({
      soulPrompt: "You are Steve.",
      overlay: "",
      memory: "",
    });
    expect(parsePersonDoorContext({})).toBeNull();
    expect(
      parsePersonDoorToolSpecs({
        tools: [{ name: "read", description: "Read a file", parameters: {} }],
      }),
    ).toEqual([
      { name: "read", description: "Read a file", parameters: {} },
    ]);
  });
});
