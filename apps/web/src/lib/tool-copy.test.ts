import { describe, expect, it } from "vitest";
import { toolActivityCopy } from "./tool-copy";

describe("toolActivityCopy", () => {
  it("uses office phrases instead of Used tool", () => {
    expect(toolActivityCopy("set_context", "running")).toBe(
      "Getting the desk ready",
    );
    expect(toolActivityCopy("set_context", "complete")).toBe(
      "Set up the desk",
    );
    expect(toolActivityCopy("code", "running")).toBe("Working in code");
    expect(toolActivityCopy("code", "complete")).toBe("Worked in code");
    expect(toolActivityCopy("shell", "running")).toBe("Using the computer");
    expect(toolActivityCopy("shell", "complete")).toBe("Used the computer");
    expect(toolActivityCopy("render_pdf", "running")).toBe("Rendering a PDF");
    expect(toolActivityCopy("render_screenshot", "complete")).toBe(
      "Took a screenshot",
    );
    expect(toolActivityCopy("ask", "running")).toBe("Asking you");
    expect(toolActivityCopy("ask", "complete")).toBe("Asked you");
  });

  it("softens cancel and unknown names", () => {
    expect(toolActivityCopy("shell", "cancelled")).toBe(
      "Stopped using the computer",
    );
    expect(toolActivityCopy("gmail_send_email", "complete")).toBe(
      "Gmail send email",
    );
    expect(toolActivityCopy("gmail_send_email", "cancelled")).toBe(
      "Stopped gmail send email",
    );
  });
});
