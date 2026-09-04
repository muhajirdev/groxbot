import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react-native";
import {
  applyPiOfficeEvent,
  emptyPiOfficeView,
  isOfficeChatStatus,
  parsePiClientEvent,
  parsePiOfficeSnapshot,
  type PiBoundMessage,
  type PiOfficeView,
  projectPiOfficeView,
  type PiProjectedMessage,
  userBoundFromText,
} from "@groxbot/core/browser";
import { newWebSocketRpcSession, RpcTarget } from "capnweb";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PiThreadStatus = "ready" | "submitted" | "streaming" | "error";

type PiHost = {
  snapshot?(): Promise<unknown>;
  subscribe(subscriber: PiThreadSubscriber): Promise<void>;
  send(input: {
    content: string;
    id?: string;
    metadata?: unknown;
    targetBotId?: string;
  }): Promise<void>;
  stop(): Promise<void>;
  [Symbol.dispose]?: () => void;
};

type SubscriberHooks = {
  onGeneration: (generation: number) => void;
  onEvent: (event: unknown) => void;
  onStatus: (status: string) => void;
  onError: (message: string) => void;
};

class PiThreadSubscriber extends RpcTarget {
  constructor(private readonly hooks: SubscriberHooks) {
    super();
  }

  streamGeneration(generation: number) {
    this.hooks.onGeneration(generation);
  }

  event(ev: unknown) {
    this.hooks.onEvent(ev);
  }

  status(status: string) {
    this.hooks.onStatus(status);
  }

  error(message: string) {
    this.hooks.onError(message);
  }
}

function textFromAppend(message: AppendMessage): string {
  const row = message as AppendMessage & { text?: unknown };
  if (typeof row.text === "string" && row.text.trim()) return row.text.trim();
  const content: unknown = message.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const row = part as { type?: unknown; text?: unknown };
      if (row.type === "text" && typeof row.text === "string") return [row.text];
      return [];
    })
    .join("\n")
    .trim();
}

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

export function usePiThread(options: {
  threadId: string;
  rpcUrl: string;
  enabled?: boolean;
  seed?: PiBoundMessage[];
  targetBotId?: string;
}) {
  const enabled = options.enabled !== false;
  const [view, setView] = useState<PiOfficeView>(() => ({
    ...emptyPiOfficeView(options.threadId),
    messages: options.seed ?? [],
  }));
  const [error, setError] = useState<Error | undefined>(undefined);
  const [connectionError, setConnectionError] = useState<Error | undefined>(
    undefined,
  );
  const readyRef = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const hostRef = useRef<PiHost | null>(null);
  const readyWaiters = useRef<Array<() => void>>([]);
  const targetRef = useRef(options.targetBotId);
  targetRef.current = options.targetBotId;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    readyRef.current = false;
    const host = newWebSocketRpcSession<PiHost>(options.rpcUrl);
    hostRef.current = host as PiHost;
    const subscriber = new PiThreadSubscriber({
      onGeneration: () => {
        // Snapshot-first subscribe already has the log; a generation bump
        // must not wipe the live turn.
      },
      onEvent: (raw) => {
        if (cancelled) return;
        const event = parsePiClientEvent(raw);
        if (!event) {
          const snapshot = parsePiOfficeSnapshot(
            raw && typeof raw === "object"
              ? (raw as { snapshot?: unknown }).snapshot
              : null,
          );
          if (!snapshot) return;
          setView((current) =>
            applyPiOfficeEvent(current, {
              threadId: options.threadId,
              seq: current.seq + 1,
              type: "snapshot",
              snapshot,
            }),
          );
          return;
        }
        setView((current) => applyPiOfficeEvent(current, event));
      },
      onStatus: (next) => {
        if (cancelled || !isOfficeChatStatus(next)) return;
        setView((current) => ({ ...current, status: next }));
      },
      onError: (message) => {
        if (cancelled || !message) return;
        setError(new Error(message));
        setView((current) => ({ ...current, error: message, status: "error" }));
      },
    });
    host
      .subscribe(subscriber)
      .then(() => {
        if (cancelled) return;
        readyRef.current = true;
        setConnectionError(undefined);
        for (const resolve of readyWaiters.current) resolve();
        readyWaiters.current = [];
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        const err =
          caught instanceof Error
            ? caught
            : new Error("Could not reach this teammate. Try sending again.");
        setConnectionError(err);
      });
    return () => {
      cancelled = true;
      hostRef.current = null;
      readyRef.current = false;
      try {
        host[Symbol.dispose]?.();
      } catch {
        // already closed
      }
    };
  }, [enabled, options.rpcUrl, options.threadId]);

  const waitReady = useCallback(async () => {
    if (readyRef.current) return;
    await new Promise<void>((resolve, reject) => {
      if (readyRef.current) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        reject(new Error("Could not reach this teammate. Try sending again."));
      }, 20_000);
      readyWaiters.current.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }, []);

  const send = useCallback(
    async (input: {
      content: string;
      id?: string;
      metadata?: unknown;
    }) => {
      await waitReady();
      const host = hostRef.current;
      if (!host) {
        throw new Error("Could not reach this teammate. Try sending again.");
      }
      const id = input.id?.trim() || crypto.randomUUID();
      await host.send({
        content: input.content,
        id,
        metadata: input.metadata,
        ...(targetRef.current ? { targetBotId: targetRef.current } : {}),
      });
    },
    [waitReady],
  );

  const onNew = useCallback(
    async (message: AppendMessage, metadata?: unknown) => {
      const content = textFromAppend(message);
      const id = crypto.randomUUID();
      const optimistic = userBoundFromText({
        id,
        content,
        metadata,
      });
      setView((current) => ({
        ...current,
        messages: current.messages.some((row) => row.id === id)
          ? current.messages
          : [...current.messages, optimistic],
        status: current.status === "streaming" ? "streaming" : "submitted",
      }));
      try {
        await send({ content, id, metadata });
      } catch (caught) {
        setView((current) => ({
          ...current,
          messages: current.messages.filter((row) => row.id !== id),
        }));
        throw caught;
      }
    },
    [send],
  );

  const stop = useCallback(async () => {
    await hostRef.current?.stop();
  }, []);

  const projected = useMemo(() => projectPiOfficeView(view), [view]);
  const status = view.status;
  const busy = status === "submitted" || status === "streaming";

  return {
    view,
    messages: view.messages,
    projected,
    status,
    error,
    connectionError,
    isStreaming: status === "streaming",
    busy,
    onNew,
    send,
    stop,
  };
}
