import { applyChatToolOutput } from "@groxbot/contracts";
import type { UIMessage } from "ai";
import { newWebSocketRpcSession, RpcTarget } from "capnweb";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { seedOutgoingUserMessage } from "./outgoing-user-message";
import { roomRpcUrl } from "./room-chat-rpc";

export type RoomChatStatus = "ready" | "submitted" | "streaming" | "error";

type RoomHost = {
  subscribe(subscriber: RoomChatSubscriber): Promise<void>;
  run(messages: unknown[], targetBotId?: string): Promise<void>;
  stop(): Promise<void>;
  [Symbol.dispose]?: () => void;
};

type SubscriberHooks = {
  onGeneration: (generation: number) => void;
  onMessage: (row: UIMessage) => void;
  onStream: (row: UIMessage) => void;
  onStatus: (status: string) => void;
  onError: (message: string) => void;
};

class RoomChatSubscriber extends RpcTarget {
  constructor(private readonly hooks: SubscriberHooks) {
    super();
  }

  streamGeneration(generation: number) {
    this.hooks.onGeneration(generation);
  }

  message(row: UIMessage) {
    this.hooks.onMessage(row);
  }

  stream(update: { message: UIMessage }) {
    this.hooks.onStream(update.message);
  }

  status(status: string) {
    this.hooks.onStatus(status);
  }

  error(message: string) {
    this.hooks.onError(message);
  }
}

function asUiMessages(rows: UIMessage[]): UIMessage[] {
  return rows.filter(
    (row) =>
      row &&
      typeof row.id === "string" &&
      (row.role === "user" ||
        row.role === "assistant" ||
        row.role === "system"),
  );
}

function upsert(messages: UIMessage[], next: UIMessage): UIMessage[] {
  const index = messages.findIndex((row) => row.id === next.id);
  if (index < 0) return [...messages, next];
  const copy = messages.slice();
  copy[index] = next;
  return copy;
}

export function useRoomChat(options: {
  roomId: string;
  targetBotId?: string;
  enabled?: boolean;
  seed?: UIMessage[];
}) {
  const enabled = options.enabled !== false;
  const [messages, setMessagesState] = useState<UIMessage[]>(
    () => options.seed ?? [],
  );
  const [status, setStatus] = useState<RoomChatStatus>("ready");
  const [error, setError] = useState<Error | undefined>(undefined);
  const [connectionError, setConnectionError] = useState<Error | undefined>(
    undefined,
  );
  const readyRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const hostRef = useRef<RoomHost | null>(null);
  const readyWaiters = useRef<Array<() => void>>([]);
  const targetRef = useRef(options.targetBotId);
  targetRef.current = options.targetBotId;

  const setMessages = useCallback(
    (update: UIMessage[] | ((current: UIMessage[]) => UIMessage[])) => {
      setMessagesState((current) =>
        typeof update === "function" ? update(current) : update,
      );
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let snapshot = true;
    readyRef.current = false;
    const host = newWebSocketRpcSession<RoomHost>(roomRpcUrl(options.roomId));
    hostRef.current = host;
    const subscriber = new RoomChatSubscriber({
      onGeneration: () => {
        if (cancelled) return;
        if (snapshot) setMessagesState([]);
      },
      onMessage: (row) => {
        if (cancelled || !row?.id) return;
        setMessagesState((current) => asUiMessages(upsert(current, row)));
      },
      onStream: (row) => {
        if (cancelled || !row?.id) return;
        setMessagesState((current) => asUiMessages(upsert(current, row)));
      },
      onStatus: (next) => {
        if (cancelled) return;
        snapshot = false;
        if (
          next === "ready" ||
          next === "submitted" ||
          next === "streaming" ||
          next === "error"
        ) {
          setStatus(next);
        }
      },
      onError: (message) => {
        if (cancelled || !message) return;
        setError(new Error(message));
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
            : new Error("Could not reach this room. Try sending again.");
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
  }, [enabled, options.roomId]);

  const waitReady = useCallback(async () => {
    if (readyRef.current) return;
    await new Promise<void>((resolve, reject) => {
      if (readyRef.current) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        reject(new Error("Could not reach this room. Try sending again."));
      }, 20_000);
      readyWaiters.current.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }, []);

  const sendMessage = useCallback(
    async (payload?: unknown) => {
      await waitReady();
      const host = hostRef.current;
      if (!host) {
        throw new Error("Could not reach this room. Try sending again.");
      }
      const id =
        payload &&
        typeof payload === "object" &&
        "messageId" in payload &&
        typeof payload.messageId === "string"
          ? payload.messageId
          : crypto.randomUUID();
      const seeded = seedOutgoingUserMessage(payload, id);
      const current = messagesRef.current;
      const next = seeded
        ? current.some((row) => row.id === id)
          ? current
          : [...current, seeded]
        : current;
      setMessagesState(next);
      await host.run(next, targetRef.current);
    },
    [waitReady],
  );

  const regenerate = useCallback(async () => {
    await waitReady();
    const host = hostRef.current;
    if (!host) {
      throw new Error("Could not reach this room. Try sending again.");
    }
    const current = messagesRef.current;
    const last = current.at(-1);
    const next = last?.role === "assistant" ? current.slice(0, -1) : current;
    setMessagesState(next);
    if (next.at(-1)?.role === "user") await host.run(next, targetRef.current);
  }, [waitReady]);

  const stop = useCallback(async () => {
    await hostRef.current?.stop();
  }, []);

  const addToolOutput = useCallback(
    async (input: {
      toolCallId: string;
      state?: "output-available" | "output-error" | "output-denied";
      output?: unknown;
      errorText?: string;
    }) => {
      setMessagesState((current) => applyChatToolOutput(current, input));
    },
    [],
  );

  const addToolApprovalResponse = useCallback(async () => {}, []);

  const clearError = useCallback(() => {
    setError(undefined);
  }, []);

  const helpers = useMemo(
    () => ({
      id: options.roomId,
      messages,
      setMessages,
      status,
      error,
      sendMessage,
      stop,
      regenerate,
      addToolOutput,
      addToolApprovalResponse,
      clearError,
      connectionError,
      isStreaming: status === "streaming",
    }),
    [
      addToolApprovalResponse,
      addToolOutput,
      clearError,
      connectionError,
      error,
      messages,
      options.roomId,
      regenerate,
      sendMessage,
      setMessages,
      status,
      stop,
    ],
  );

  return helpers;
}
