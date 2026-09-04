/** Patch the last assistant tool part the way AI SDK `Chat.addToolOutput` does. */

export type ChatToolOutput = {
  toolCallId: string;
  state?: "output-available" | "output-error" | "output-denied";
  output?: unknown;
  errorText?: string;
};

type ChatToolRow = {
  role?: string;
  parts?: Array<{ toolCallId?: unknown; [key: string]: unknown }>;
};

export function applyChatToolOutput<T extends ChatToolRow>(
  messages: readonly T[],
  input: ChatToolOutput,
): T[] {
  if (messages.length === 0) return [...messages];
  const lastIndex = messages.length - 1;
  const last = messages[lastIndex];
  if (last?.role !== "assistant" || !Array.isArray(last.parts)) {
    return [...messages];
  }
  const state = input.state ?? "output-available";
  let changed = false;
  const parts = last.parts.map((part) => {
    if (part.toolCallId !== input.toolCallId) return part;
    changed = true;
    return {
      ...part,
      state,
      ...(input.output !== undefined ? { output: input.output } : {}),
      ...(typeof input.errorText === "string"
        ? { errorText: input.errorText }
        : {}),
    };
  });
  if (!changed) return [...messages];
  const next = messages.slice();
  next[lastIndex] = { ...last, parts };
  return next;
}
