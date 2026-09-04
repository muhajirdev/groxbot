export type ThreadWaitingMessage = {
  role?: string;
  status?: { type?: string } | undefined;
  parts?: ReadonlyArray<{ type: string; text?: string }>;
};

export type ThreadWaitingInput = {
  isRunning: boolean;
  /** Composer dispatched, but chat status has not reached submitted yet. */
  pending?: boolean;
  lastMessage?: ThreadWaitingMessage | null;
};

function partLooksLikeTool(type: string): boolean {
  return (
    type === "tool-call" ||
    type === "standalone-tool-call" ||
    type === "group-tool" ||
    type === "dynamic-tool" ||
    type.startsWith("tool-")
  );
}

/** Visible assistant work — text, tools, or files. Not reasoning. */
export function assistantTurnHasVisibleWork(
  message: ThreadWaitingMessage | null | undefined,
): boolean {
  if (message?.role !== "assistant") return false;
  return Boolean(
    message.parts?.some((part) => {
      if (part.type === "text") return Boolean(part.text?.trim());
      if (part.type === "file" || part.type === "image") return true;
      return partLooksLikeTool(part.type);
    }),
  );
}

/**
 * Show "{bot} is working" from send until the first visible assistant work.
 *
 * Empty / reasoning-only assistant messages stay hidden in the transcript, so
 * treating `last.role === "assistant"` as "the turn has started" leaves a dead
 * gap. `pending` covers the window after the composer clears and before the
 * socket/chat status flips to submitted.
 */
export function isWaitingForAssistantTurn(input: ThreadWaitingInput): boolean {
  const last = input.lastMessage;
  const visible = assistantTurnHasVisibleWork(last);
  if (visible) return Boolean(input.pending && !input.isRunning);
  return Boolean(input.pending || input.isRunning);
}
