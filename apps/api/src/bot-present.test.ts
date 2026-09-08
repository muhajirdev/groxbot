import { PRESENT_TOOL_PARAMETERS, runPresent } from "@groxbot/core";
import { describe, expect, it } from "vitest";
import { createPresentTool } from "./bot-present.js";

describe("createPresentTool", () => {
  it("stays open so a File-shaped argument is not rejected before execute", () => {
    const tool = createPresentTool();
    expect(tool.parameters).toEqual(PRESENT_TOOL_PARAMETERS);
    expect(tool.parameters).toMatchObject({
      additionalProperties: true,
    });
    expect(tool.parameters).not.toMatchObject({ required: ["$type"] });
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

  it("composes a file chip when the model omits $type", async () => {
    const tool = createPresentTool();
    const result = await tool.execute("call_file", {
      path: "invoice.html",
      place: "computer",
    });
    expect(result.details).toEqual({
      ok: true,
      $type: "File",
      preview: "invoice.html",
    });
  });
});
