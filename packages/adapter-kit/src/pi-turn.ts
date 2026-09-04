import type { AgentRunRequest } from "./types.js";

/** One line in an owned transcript. Soul never lives here. */
export type OwnedPiLine = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Pi `runAgentLoopContinue` input you own: stable system prompt (soul) plus
 * the room/office log as messages. Two bots with the same log get two souls.
 */
export interface OwnedPiTurn {
  systemPrompt: string;
  messages: OwnedPiLine[];
}

export type OwnedPiHistoryLine = {
  role: "user" | "assistant" | "system";
  content: string;
};

/**
 * Soul is only `systemPrompt`. History `system` rows are dropped (not merged
 * into the soul — that would mix two bots on one cache prefix). The last
 * message is always `user` so the loop can continue.
 */
export function buildOwnedPiTurn(input: {
  soul: string;
  messages: OwnedPiHistoryLine[];
  prompt?: string;
}): OwnedPiTurn {
  const systemPrompt = input.soul.trim();
  const messages: OwnedPiLine[] = [];
  for (const item of input.messages) {
    const content = item.content.trim();
    if (!content) continue;
    if (item.role === "system") continue;
    messages.push({ role: item.role, content });
  }
  const prompt = input.prompt?.trim();
  const last = messages.at(-1);
  if (prompt && (last?.role !== "user" || last.content !== prompt)) {
    messages.push({ role: "user", content: prompt });
  }
  if (messages.length === 0 || messages.at(-1)?.role === "assistant") {
    messages.push({ role: "user", content: prompt || "Hello" });
  }
  return { systemPrompt, messages };
}

export function ownedPiTurnFromRun(request: AgentRunRequest): OwnedPiTurn {
  return buildOwnedPiTurn({
    soul: request.instructions,
    messages: request.history,
    prompt: request.prompt,
  });
}
