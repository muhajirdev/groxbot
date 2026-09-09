import { describe, expect, it } from "vitest";
import { OFFICE_ASK_TOOL_NAME } from "@groxbot/core";
import { createAskTool, OfficeAskBoard } from "./bot-ask.js";

describe("OfficeAskBoard", () => {
  it("returns unattended when the office human is not on this turn", async () => {
    const board = new OfficeAskBoard();
    const result = await board.wait(
      { question: "Ship today?" },
      { toolCallId: "call_1" },
    );
    expect(result).toMatchObject({
      ok: true,
      skipped: true,
      reason: "unattended",
    });
  });

  it("parks until answerAsk", async () => {
    const board = new OfficeAskBoard();
    board.enterLive();
    const pending = board.wait(
      { question: "Tone?", options: ["Casual", "Formal"] },
      { toolCallId: "call_1" },
    );
    expect(board.pending()).toHaveLength(1);
    const answered = board.answer("call_1", { selected: "casual" });
    expect(answered?.message).toBe("Tone?: Casual");
    await expect(pending).resolves.toMatchObject({
      skipped: false,
      message: "Tone?: Casual",
    });
    expect(board.pending()).toHaveLength(0);
  });

  it("aborts waiters when the turn ends", async () => {
    const board = new OfficeAskBoard();
    board.enterLive();
    const abort = new AbortController();
    const pending = board.wait(
      { question: "Go?" },
      { toolCallId: "call_2", signal: abort.signal },
    );
    abort.abort();
    await expect(pending).resolves.toMatchObject({ reason: "aborted" });
    board.leaveLive();
    expect(board.pending()).toHaveLength(0);
  });
});

describe("createAskTool", () => {
  it("is named ask", () => {
    const tool = createAskTool(new OfficeAskBoard());
    expect(tool.name).toBe(OFFICE_ASK_TOOL_NAME);
  });

  it("throws on an empty question so Pi marks isError", async () => {
    const board = new OfficeAskBoard();
    board.enterLive();
    const tool = createAskTool(board);
    await expect(tool.execute("call_1", {})).rejects.toThrow(/ask needs a question/);
  });
});
