import { clampMaxTokensToContext } from "@earendil-works/pi-ai/api/simple-options";
import type { AssistantMessage, Context, Model } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { withAssistantUsage } from "./pi-context-usage.js";

const model = {
  id: "groxbot/auto",
  contextWindow: 1_048_576,
  maxTokens: 8192,
} as Model<"openai-completions">;

function assistantWithoutUsage(): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text: "Generating it now." }],
    api: "openai-completions",
    provider: "grox-gateway",
    model: "groxbot/auto",
    responseModel: "gemini-3.8-flash",
    stopReason: "stop",
    timestamp: 1,
  } as AssistantMessage;
}

describe("withAssistantUsage", () => {
  it("fills missing usage so Pi can estimate context after Auto routes to Gemini", () => {
    const context: Context = {
      messages: [assistantWithoutUsage()],
    };
    expect(() => clampMaxTokensToContext(model, context, 1024)).toThrow(
      /totalTokens/,
    );
    expect(() =>
      clampMaxTokensToContext(model, withAssistantUsage(context), 1024),
    ).not.toThrow();
    expect(withAssistantUsage(context).messages[0]).toMatchObject({
      usage: { totalTokens: 0, input: 0, output: 0 },
    });
  });

  it("leaves a real usage object alone", () => {
    const usage = {
      input: 11,
      output: 7,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 18,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    };
    const context: Context = {
      messages: [{ ...assistantWithoutUsage(), usage }],
    };
    expect(withAssistantUsage(context)).toBe(context);
  });
});
