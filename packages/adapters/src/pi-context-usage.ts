import type { Context, Message, Usage } from "@earendil-works/pi-ai";

export function emptyPiAiUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function assistantUsageMissing(message: Message): boolean {
  if (message.role !== "assistant") return false;
  const usage = (message as { usage?: Usage }).usage;
  return usage == null || typeof usage !== "object";
}

/** Pi `streamSimple` reads `usage.totalTokens` with no null check. Gemini via groxbot/auto often omits it. */
export function withAssistantUsage(context: Context): Context {
  let changed = false;
  const messages = context.messages.map((message) => {
    if (!assistantUsageMissing(message)) return message;
    changed = true;
    return { ...message, usage: emptyPiAiUsage() };
  });
  return changed ? { ...context, messages } : context;
}
