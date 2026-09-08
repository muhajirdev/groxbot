export type ThreadWaitingMessage = {
  role?: string;
  status?: { type?: string } | undefined;
  parts?: ReadonlyArray<{
    type: string;
    text?: string;
    status?: { type?: string };
  }>;
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

/** A tool is the live progress — hide the generic “is working” line. */
export function assistantTurnHasRunningTool(
  message: ThreadWaitingMessage | null | undefined,
): boolean {
  if (message?.role !== "assistant") return false;
  return Boolean(
    message.parts?.some((part) => {
      if (!partLooksLikeTool(part.type)) return false;
      return part.status?.type === "running";
    }),
  );
}

/** Visible assistant work — text, reasoning, tools, or files. */
export function assistantTurnHasVisibleWork(
  message: ThreadWaitingMessage | null | undefined,
): boolean {
  if (message?.role !== "assistant") return false;
  return Boolean(
    message.parts?.some((part) => {
      if (part.type === "text") return Boolean(part.text?.trim());
      if (part.type === "reasoning" || part.type === "group-reasoning") {
        return true;
      }
      if (part.type === "file" || part.type === "image") return true;
      return partLooksLikeTool(part.type);
    }),
  );
}

/**
 * Show "{bot} is working" from send until the first visible assistant work.
 *
 * `pending` covers the window after the composer clears and before the
 * socket/chat status flips to submitted.
 */
export function isWaitingForAssistantTurn(input: ThreadWaitingInput): boolean {
  const last = input.lastMessage;
  const visible = assistantTurnHasVisibleWork(last);
  if (visible) return Boolean(input.pending && !input.isRunning);
  return Boolean(input.pending || input.isRunning);
}

/** Hire: keep the working state through create + the first socket snapshot. */
export function isOfficeHireWaiting(input: {
  opening: boolean;
  hired: boolean;
  connected: boolean;
  failed?: boolean;
}): boolean {
  if (input.failed) return false;
  if (input.opening) return true;
  return input.hired && !input.connected;
}
