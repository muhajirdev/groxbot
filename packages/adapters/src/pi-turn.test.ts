import { describe, expect, it } from "vitest";
import { buildOwnedPiTurn } from "@groxbot/adapter-kit";
import {
  piCompletionsModel,
  runOwnedPiTurn,
  scriptedPiStreamFn,
} from "./pi-turn.js";

const model = piCompletionsModel("test-model");

describe("runOwnedPiTurn", () => {
  it("runs an owned log through Pi without putting soul in the messages", async () => {
    const seen: Array<{ systemPrompt?: string; lastRole?: string }> = [];
    const steve = buildOwnedPiTurn({
      soul: "You are Steve Jobs.",
      messages: [{ role: "user", content: "Pitch the offer." }],
    });
    const result = await runOwnedPiTurn({
      ...steve,
      model,
      streamFn: (calledModel, context) => {
        seen.push({
          systemPrompt: context.systemPrompt,
          lastRole: context.messages.at(-1)?.role,
        });
        expect(calledModel.id).toBe("test-model");
        expect(
          context.messages.some(
            (message) =>
              message.role === "user" &&
              typeof message.content === "string" &&
              message.content.includes("Steve"),
          ),
        ).toBe(false);
        return scriptedPiStreamFn("Make it insanely great.")(
          calledModel,
          context,
        );
      },
    });
    expect(seen).toEqual([
      { systemPrompt: "You are Steve Jobs.", lastRole: "user" },
    ]);
    expect(result.text).toBe("Make it insanely great.");
    expect(result.stopReason).toBe("stop");
  });

  it("keeps two souls on the same room log", async () => {
    const room = [{ role: "user" as const, content: "Pitch the offer." }];
    const prefixes: string[] = [];
    const streamFor = (reply: string) =>
      scriptedPiStreamFn(reply);
    const steve = await runOwnedPiTurn({
      ...buildOwnedPiTurn({ soul: "You are Steve Jobs.", messages: room }),
      model,
      streamFn: (called, context) => {
        prefixes.push(context.systemPrompt ?? "");
        return streamFor("Insanely great.")(called, context);
      },
    });
    const hormozi = await runOwnedPiTurn({
      ...buildOwnedPiTurn({ soul: "You are Alex Hormozi.", messages: room }),
      model,
      streamFn: (called, context) => {
        prefixes.push(context.systemPrompt ?? "");
        return streamFor("Grand slam offer.")(called, context);
      },
    });
    expect(prefixes).toEqual([
      "You are Steve Jobs.",
      "You are Alex Hormozi.",
    ]);
    expect(steve.text).toBe("Insanely great.");
    expect(hormozi.text).toBe("Grand slam offer.");
  });

  it("encodes abort on the assistant message", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runOwnedPiTurn({
      ...buildOwnedPiTurn({
        soul: "You are Piper.",
        messages: [{ role: "user", content: "hello" }],
      }),
      model,
      signal: controller.signal,
      streamFn: scriptedPiStreamFn("should not appear"),
    });
    expect(result.stopReason).toBe("aborted");
    expect(result.text).toBe("");
  });
});
