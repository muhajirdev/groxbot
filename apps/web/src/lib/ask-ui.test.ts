import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AskSurface } from "../components/AskToolUI";
import { OfficeAskActionsContext } from "./office-ask-actions";

describe("AskSurface", () => {
  it("renders option buttons for a parked question", () => {
    const html = renderToStaticMarkup(
      createElement(
        OfficeAskActionsContext.Provider,
        {
          value: {
            answer: async () => undefined,
            skip: async () => undefined,
          },
        },
        createElement(AskSurface, {
          toolCallId: "call_1",
          args: { question: "Tone?", options: ["Casual", "Formal"] },
          running: true,
        }),
      ),
    );
    expect(html).toContain("data-slot=\"office-ask\"");
    expect(html).toContain("Tone?");
    expect(html).toContain("Casual");
    expect(html).toContain("Formal");
    expect(html).toContain("You decide");
  });

  it("shows the settled answer", () => {
    const html = renderToStaticMarkup(
      createElement(AskSurface, {
        toolCallId: "call_1",
        args: { question: "Tone?", options: ["Casual"] },
        result: {
          ok: true,
          skipped: false,
          answers: [{ id: "tone", prompt: "Tone?", value: "Casual" }],
          message: "Tone?: Casual",
        },
      }),
    );
    expect(html).toContain("Casual");
    expect(html).not.toContain("You decide");
  });
});
