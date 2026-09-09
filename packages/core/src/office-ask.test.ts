import { describe, expect, it } from "vitest";
import {
  applyOfficeAskAnswers,
  MAX_ASK_OPTIONS,
  MAX_ASK_QUESTIONS,
  OFFICE_ASK_TOOL_NAME,
  officeAskSkipped,
  parseOfficeAskArgs,
  parseOfficeAskInput,
  parseOfficeAskResult,
  parsePendingAsks,
} from "./office-ask.js";

describe("parseOfficeAskInput", () => {
  it("accepts a single question string", () => {
    const parsed = parseOfficeAskInput({ question: "Ship today or next week?" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.questions).toEqual([
      {
        id: "ship-today-or-next-week",
        prompt: "Ship today or next week?",
        options: [],
        multi: false,
      },
    ]);
  });

  it("normalizes option strings and a questions array", () => {
    const parsed = parseOfficeAskInput({
      questions: [
        {
          prompt: "Tone?",
          options: ["Casual", { label: "Formal", id: "formal" }],
        },
        { question: "Also ping Slack?", options: ["Yes", "No"], multi: true },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.questions[0]?.options.map((row) => row.id)).toEqual([
      "casual",
      "formal",
    ]);
    expect(parsed.questions[1]?.multi).toBe(true);
    expect(parsed.questions[1]?.prompt).toBe("Also ping Slack?");
  });

  it("caps questions and options", () => {
    const parsed = parseOfficeAskInput({
      questions: Array.from({ length: MAX_ASK_QUESTIONS + 2 }, (_, i) => ({
        prompt: `Q${i}`,
        options: Array.from({ length: MAX_ASK_OPTIONS + 3 }, (_, j) => `o${j}`),
      })),
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.questions).toHaveLength(MAX_ASK_QUESTIONS);
    expect(parsed.questions[0]?.options).toHaveLength(MAX_ASK_OPTIONS);
  });

  it("rejects an empty call", () => {
    expect(parseOfficeAskInput({})).toMatchObject({
      ok: false,
      message: expect.stringMatching(/ask needs a question/),
    });
  });
});

describe("applyOfficeAskAnswers", () => {
  const prompt = {
    toolCallId: "call_1",
    questions: parseOfficeAskArgs({
      questions: [
        { prompt: "Tone?", options: ["Casual", "Formal"] },
        { prompt: "Length?", options: ["Short", "Long"] },
      ],
    }),
  };

  it("maps selected option ids back to labels", () => {
    const result = applyOfficeAskAnswers(prompt, {
      answers: [
        { id: "tone", selected: ["casual"] },
        { id: "length", selected: ["short"] },
      ],
    });
    expect(result.skipped).toBe(false);
    expect(result.message).toBe("Tone?: Casual\nLength?: Short");
  });

  it("accepts a lone string for one question", () => {
    const one = {
      toolCallId: "call_2",
      questions: parseOfficeAskArgs({ question: "What should we call it?" }),
    };
    expect(applyOfficeAskAnswers(one, "Desk").message).toBe(
      "What should we call it?: Desk",
    );
  });

  it("treats an explicit skip as skipped", () => {
    expect(applyOfficeAskAnswers(prompt, { skipped: true })).toEqual(
      officeAskSkipped("skipped"),
    );
  });
});

describe("parsePendingAsks", () => {
  it("keeps only parked questionnaires", () => {
    expect(
      parsePendingAsks([
        {
          toolCallId: "call_1",
          questions: [{ prompt: "Tone?", options: ["Casual"] }],
        },
        { questions: [{ prompt: "Missing id" }] },
      ]),
    ).toEqual([
      {
        toolCallId: "call_1",
        questions: [
          {
            id: "tone",
            prompt: "Tone?",
            options: [{ id: "casual", label: "Casual" }],
            multi: false,
          },
        ],
      },
    ]);
  });
});

describe("parseOfficeAskResult", () => {
  it("reads the structured tool dump", () => {
    const result = parseOfficeAskResult({
      ok: true,
      skipped: false,
      answers: [{ id: "tone", prompt: "Tone?", value: "Casual" }],
      message: "Tone?: Casual",
    });
    expect(result?.message).toBe("Tone?: Casual");
  });

  it("parses JSON text the loop stores", () => {
    const result = parseOfficeAskResult(
      JSON.stringify(officeAskSkipped("unattended")),
    );
    expect(result?.skipped).toBe(true);
    expect(result?.reason).toBe("unattended");
  });
});

describe("OFFICE_ASK_TOOL_NAME", () => {
  it("is the short coding-agent name", () => {
    expect(OFFICE_ASK_TOOL_NAME).toBe("ask");
  });
});
