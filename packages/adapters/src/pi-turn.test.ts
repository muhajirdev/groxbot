import { buildOwnedPiTurn } from "@groxbot/adapter-kit";
import { describe, expect, it } from "vitest";
import { openObjectParameters } from "./office-pi.js";
import {
  piCompletionsModel,
  runOwnedPiTurn,
  runPiTurn,
  scriptedPiSequenceStreamFn,
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
    const streamFor = (reply: string) => scriptedPiStreamFn(reply);
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
    expect(prefixes).toEqual(["You are Steve Jobs.", "You are Alex Hormozi."]);
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

  it("passes reasoning through to the stream", async () => {
    let seen: string | undefined;
    const result = await runPiTurn({
      systemPrompt: "You are Piper.",
      messages: [{ role: "user", content: "think" }],
      model,
      reasoning: "high",
      streamFn: (called, context, options) => {
        seen = options?.reasoning;
        return scriptedPiStreamFn("ok")(called, context, options);
      },
    });
    expect(seen).toBe("high");
    expect(result.text).toBe("ok");
  });

  it("executes AgentTools and continues with the tool result", async () => {
    const seen: string[] = [];
    let executed = "";
    const result = await runPiTurn({
      systemPrompt: "You are Piper.",
      messages: [{ role: "user", content: "present the offer" }],
      model,
      tools: [
        {
          name: "present",
          label: "present",
          description: "Show a glanceable tree.",
          parameters: openObjectParameters(),
          execute: async (_id, params) => {
            executed = JSON.stringify(params);
            return {
              content: [{ type: "text", text: "shown" }],
              details: { ok: true },
            };
          },
        },
      ],
      streamFn: scriptedPiSequenceStreamFn([
        {
          tool: {
            id: "call_1",
            name: "present",
            arguments: { $type: "Card" },
          },
        },
        { text: "Shown." },
      ]),
      onEvent: (event) => {
        seen.push(event.type);
      },
    });
    expect(executed).toBe('{"$type":"Card"}');
    expect(result.text).toBe("Shown.");
    expect(result.stopReason).toBe("stop");
    expect(seen).toContain("tool_execution_end");
  });

  it("injects a steering user after tools and before the next model call", async () => {
    const lastUser: string[] = [];
    const steer = [
      {
        role: "user" as const,
        content: "stop, summarize instead",
        timestamp: 2,
      },
    ];
    const scripted = scriptedPiSequenceStreamFn([
      {
        tool: { id: "call_1", name: "list", arguments: { path: "/" } },
      },
      { text: "Okay, summary." },
    ]);
    let skipStartPoll = true;
    const result = await runPiTurn({
      systemPrompt: "You are Piper.",
      messages: [{ role: "user", content: "list files" }],
      model,
      tools: [
        {
          name: "list",
          label: "list",
          description: "List files.",
          parameters: openObjectParameters(),
          execute: async () => ({
            content: [{ type: "text", text: "[]" }],
            details: { entries: [] },
          }),
        },
      ],
      getSteeringMessages: () => {
        if (skipStartPoll) {
          skipStartPoll = false;
          return [];
        }
        return steer.splice(0);
      },
      streamFn: (called, context) => {
        const last = context.messages.at(-1);
        lastUser.push(
          last?.role === "user" && typeof last.content === "string"
            ? last.content
            : String(last?.role ?? ""),
        );
        return scripted(called, context);
      },
    });
    expect(lastUser).toEqual(["list files", "stop, summarize instead"]);
    expect(result.text).toBe("Okay, summary.");
  });

  it("omits old fat tool dumps from the model context", async () => {
    const seen: string[] = [];
    const fat = "g".repeat(20_000);
    const result = await runPiTurn({
      systemPrompt: "You are Piper.",
      messages: [
        { role: "user", content: "check gmail", timestamp: 1 },
        {
          role: "toolResult",
          toolCallId: "call_old",
          toolName: "code",
          content: [{ type: "text", text: fat }],
          details: { raw: fat },
          isError: false,
          timestamp: 2,
        },
        { role: "user", content: "again", timestamp: 3 },
      ],
      model,
      streamFn: (called, context) => {
        const tool = context.messages.find((row) => row.role === "toolResult");
        const text =
          tool && tool.role === "toolResult"
            ? tool.content
                .map((part) =>
                  part.type === "text" ? part.text : "",
                )
                .join("")
            : "";
        seen.push(text);
        expect(text.length).toBeLessThan(fat.length);
        expect(text).toMatch(/Omitted from the live window/);
        expect(text).not.toContain("gggg");
        return scriptedPiStreamFn("ok")(called, context);
      },
    });
    expect(result.text).toBe("ok");
    expect(seen).toHaveLength(1);
  });

  it("sends a compaction summary into the model as a user message", async () => {
    const seen: string[] = [];
    const result = await runPiTurn({
      systemPrompt: "You are Piper.",
      messages: [
        {
          role: "compactionSummary",
          summary: "## Goal\nKeep the inbox current.",
          tokensBefore: 90_000,
          timestamp: 1,
        },
        { role: "user", content: "again", timestamp: 2 },
      ],
      model,
      streamFn: (called, context) => {
        const first = context.messages[0];
        seen.push(
          first?.role === "user"
            ? typeof first.content === "string"
              ? first.content
              : JSON.stringify(first.content)
            : String(first?.role ?? ""),
        );
        return scriptedPiStreamFn("ok")(called, context);
      },
    });
    expect(result.text).toBe("ok");
    expect(seen[0]).toMatch(/compacted into the following summary/);
    expect(seen[0]).toMatch(/Keep the inbox current/);
  });

  it("strips encrypted thought replay before the model call", async () => {
    const seen: unknown[] = [];
    const result = await runPiTurn({
      systemPrompt: "You are Piper.",
      messages: [
        { role: "user", content: "run it", timestamp: 1 },
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call_1",
              name: "bash",
              arguments: { command: "ls" },
              thoughtSignature: JSON.stringify({
                type: "reasoning.encrypted",
                id: "rs_1",
                data: "stale-blob",
              }),
            },
          ],
          api: "openai-completions",
          provider: "openai",
          model: "test-model",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "toolUse",
          timestamp: 2,
        },
        {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "bash",
          content: [{ type: "text", text: "ok" }],
          isError: false,
          timestamp: 3,
        },
      ],
      model,
      stripThoughtReplay: true,
      streamFn: (called, context) => {
        const assistant = context.messages.find(
          (message) => message.role === "assistant",
        );
        seen.push(
          assistant && "content" in assistant
            ? assistant.content
            : assistant,
        );
        return scriptedPiStreamFn("ok")(called, context);
      },
    });
    expect(result.text).toBe("ok");
    expect(JSON.stringify(seen[0])).not.toMatch(/stale-blob/);
    expect(JSON.stringify(seen[0])).not.toMatch(/thoughtSignature/);
  });
});
