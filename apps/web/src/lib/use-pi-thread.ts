import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react";
import {
  type PiBoundMessage,
  type PiProjectedMessage,
  projectPiOfficeView,
} from "@groxbot/core/browser";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { ensurePiThread } from "./pi-thread-session";
import { textFromAppendMessage } from "./outgoing-user-message";

export type PiThreadStatus = "ready" | "submitted" | "streaming" | "error";

export function projectedToThreadMessage(
  message: PiProjectedMessage,
): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content: message.content as ThreadMessageLike["content"],
    createdAt:
      typeof message.createdAt === "number"
        ? new Date(message.createdAt)
        : undefined,
    status: message.status as ThreadMessageLike["status"],
    metadata: message.metadata as ThreadMessageLike["metadata"],
  };
}

/** React view of the process-wide office session. Unmount does not drop the socket. */
export function usePiThread(options: {
  threadId: string;
  rpcUrl: string;
  enabled?: boolean;
  seed?: PiBoundMessage[];
  targetBotId?: string;
}) {
  const session = ensurePiThread({
    threadId: options.threadId,
    rpcUrl: options.rpcUrl,
    seed: options.seed,
    targetBotId: options.targetBotId,
  });
  if (options.enabled !== false) {
    session.setTarget(options.targetBotId);
    session.connect();
  }
  const snap = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const view = snap.view;
  const projected = useMemo(() => projectPiOfficeView(view), [view]);
  const status = view.status;
  const busy = status === "submitted" || status === "streaming";

  const send = useCallback(
    async (input: { content: string; id?: string; metadata?: unknown }) => {
      await session.send(input);
    },
    [session],
  );

  const onNew = useCallback(
    async (message: AppendMessage, metadata?: unknown) => {
      await session.onNew({
        content: textFromAppendMessage(message),
        metadata,
      });
    },
    [session],
  );

  const stop = useCallback(async () => {
    await session.stop();
  }, [session]);

  const pendingApprovals = useCallback(
    () => session.pendingApprovals(),
    [session],
  );
  const approveApproval = useCallback(
    (executionId: string) => session.approveApproval(executionId),
    [session],
  );
  const rejectApproval = useCallback(
    (executionId: string, seq: number) =>
      session.rejectApproval(executionId, seq),
    [session],
  );

  return {
    view,
    messages: view.messages,
    projected,
    status,
    error: snap.error,
    connectionError: snap.connectionError,
    connected: snap.connected,
    isStreaming: status === "streaming",
    busy,
    floorBotId: view.floorBotId,
    onNew,
    send,
    stop,
    pendingApprovals,
    approveApproval,
    rejectApproval,
  };
}
