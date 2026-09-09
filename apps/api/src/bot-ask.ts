/** Cloudflare-only. Parks `ask` until the office human answers. */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  applyOfficeAskAnswers,
  OFFICE_ASK_TOOL_DESCRIPTION,
  OFFICE_ASK_TOOL_NAME,
  officeAskPrompt,
  officeAskSkipped,
  parseOfficeAskInput,
  type OfficeAskParseFail,
  type OfficeAskPrompt,
  type OfficeAskResult,
} from "@groxbot/core";
import { z } from "zod";
import { officeAgentTool } from "./bot-office-tools.js";

type AskWaiter = {
  prompt: OfficeAskPrompt;
  resolve: (result: OfficeAskResult) => void;
};

export class OfficeAskBoard {
  private live = false;
  private waiters = new Map<string, AskWaiter>();

  enterLive(): void {
    this.live = true;
  }

  leaveLive(): void {
    this.live = false;
    this.abortAll();
  }

  pending(): OfficeAskPrompt[] {
    return [...this.waiters.values()].map((row) => row.prompt);
  }

  async wait(
    input: unknown,
    ctx: { toolCallId: string; signal?: AbortSignal },
  ): Promise<OfficeAskResult | OfficeAskParseFail> {
    const parsed = parseOfficeAskInput(input);
    if (!parsed.ok) return parsed;
    if (!this.live) return officeAskSkipped("unattended");
    const toolCallId = ctx.toolCallId.trim() || crypto.randomUUID();
    const prompt = officeAskPrompt(toolCallId, parsed.questions);
    return new Promise((resolve) => {
      const finish = (result: OfficeAskResult) => {
        const waiter = this.waiters.get(toolCallId);
        if (!waiter) return;
        this.waiters.delete(toolCallId);
        ctx.signal?.removeEventListener("abort", onAbort);
        resolve(result);
      };
      const onAbort = () => finish(officeAskSkipped("aborted"));
      if (ctx.signal?.aborted) {
        resolve(officeAskSkipped("aborted"));
        return;
      }
      this.waiters.set(toolCallId, { prompt, resolve: finish });
      ctx.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  answer(toolCallId: string, payload: unknown): OfficeAskResult | null {
    const waiter = this.waiters.get(toolCallId.trim());
    if (!waiter) return null;
    const result = applyOfficeAskAnswers(waiter.prompt, payload);
    waiter.resolve(result);
    return result;
  }

  skip(toolCallId: string): OfficeAskResult | null {
    const waiter = this.waiters.get(toolCallId.trim());
    if (!waiter) return null;
    const result = officeAskSkipped("skipped");
    waiter.resolve(result);
    return result;
  }

  private abortAll(): void {
    const pending = [...this.waiters.values()];
    this.waiters.clear();
    for (const waiter of pending) waiter.resolve(officeAskSkipped("aborted"));
  }
}

const askOption = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    label: z.string().optional(),
    text: z.string().optional(),
  }),
]);

const askQuestion = z.object({
  id: z.string().optional(),
  prompt: z.string().optional(),
  question: z.string().optional(),
  text: z.string().optional(),
  options: z.array(askOption).optional(),
  multi: z.boolean().optional(),
  multiSelect: z.boolean().optional(),
});

export function createAskTool(board: OfficeAskBoard): AgentTool {
  return officeAgentTool({
    name: OFFICE_ASK_TOOL_NAME,
    description: OFFICE_ASK_TOOL_DESCRIPTION,
    parameters: z.object({
      questions: z.array(askQuestion).optional(),
      question: z.string().optional(),
      prompt: z.string().optional(),
      options: z.array(askOption).optional(),
      multi: z.boolean().optional(),
    }),
    execute: async (input, ctx) => board.wait(input, ctx),
  });
}
