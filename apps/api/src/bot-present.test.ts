import { PRESENT_TOOL_PARAMETERS, runPresent } from "@groxbot/core";
import { describe, expect, it } from "vitest";
import { createPresentTool } from "./bot-present.js";

describe("createPresentTool", () => {
  it("advertises a shallow $type schema so the model does not send {}", () => {
    const tool = createPresentTool();
    expect(tool.parameters).toEqual(PRESENT_TOOL_PARAMETERS);
    expect(tool.parameters).toMatchObject({
      required: ["$type"],
      additionalProperties: true,
    });
  });

  it("still composes wrapped trees at execute time", async () => {
    const tool = createPresentTool();
    const result = await tool.execute("call_1", {
      raw: { $type: "Card", title: "Invoice" },
    });
    expect(result.details).toEqual(
      runPresent({ $type: "Card", title: "Invoice" }),
    );
  });
});
