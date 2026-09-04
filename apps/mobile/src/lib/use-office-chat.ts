import type { UIMessage } from "ai";
import { newWebSocketRpcSession, RpcTarget } from "capnweb";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { officeRpcUrl } from "./host";
import { seedOutgoingUserMessage } from "./outgoing-user-message";

export type OfficeChatStatus = "ready" | "submitted" | "streaming" | "error";

type OfficeHost = {
  subscribe(subscriber: OfficeChatSubscriber): Promise<void>;
  run(messages: unknown[]): Promise<void>;
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

class OfficeChatSubscriber extends RpcTarget {
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

function upsert(messages: UIMessage[], next: UIMessage): UIMessage[] {
  const index = messages.findIndex((row) => row.id === next.id);
  if (index < 0) return [...messages, next];
  const copy = messages.slice();
  copy[index] = next;
  return copy;
}

export function useOfficeChat(options: {
  botId: string;
  enabled?: boolean;
  seed?: UIMessage[];
  cookie?: string;
}) {
  const enabled = options.enabled !== false;
  const [messages, setMessagesState] = useState<UIMessage[]>(
    () => options.seed ?? [],
  );
  const [status, setStatus] = useState<OfficeChatStatus>("ready");
  const [error, setError] = useState<Error | undefined>(undefined);
  const [connectionError, setConnectionError] = useState<Error | undefined>(
    undefined,
  );
  const readyRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const hostRef = useRef<OfficeHost | null>(null);
  const readyWaiters = useRef<Array<() => void>>([]);

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
    const url = officeRpcUrl(options.botId);
    const cookie = options.cookie?.trim();
    const session = cookie
      ? `${url}?Cookie=${encodeURIComponent(cookie)}`
      : url;
    const host = newWebSocketRpcSession<OfficeHost>(session);
    hostRef.current = host;
    const subscriber = new OfficeChatSubscriber({
      onGeneration: () => {
        if (cancelled) return;
        if (snapshot) setMessagesState([]);
      },
      onMessage: (row) => {
        if (cancelled || !row?.id) return;
        setMessagesState((current) => upsert(current, row));
      },
      onStream: (row) => {
        if (cancelled || !row?.id) return;
        setMessagesState((current) => upsert(current, row));
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
  }, [enabled, options.botId, options.cookie]);

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

  const sendMessage = useCallback(
    async (payload?: unknown) => {
      await waitReady();
      const host = hostRef.current;
      if (!host) {
        throw new Error("Could not reach this teammate. Try sending again.");
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
      await host.run(next);
    },
    [waitReady],
  );

  const regenerate = useCallback(async () => {
    await waitReady();
    const host = hostRef.current;
    if (!host) {
      throw new Error("Could not reach this teammate. Try sending again.");
    }
    const current = messagesRef.current;
    const last = current.at(-1);
    const next = last?.role === "assistant" ? current.slice(0, -1) : current;
    setMessagesState(next);
    if (next.at(-1)?.role === "user") await host.run(next);
  }, [waitReady]);

  const stop = useCallback(async () => {
    await hostRef.current?.stop();
  }, []);

  const addToolOutput = useCallback(async () => {
    // Office tools run on the actor. Client tool results are not a v1 path.
  }, []);

  const helpers = useMemo(
    () => ({
      id: options.botId,
      messages,
      setMessages,
      status,
      error,
      sendMessage,
      stop,
      regenerate,
      addToolOutput,
      connectionError,
      isStreaming: status === "streaming",
    }),
    [
      addToolOutput,
      connectionError,
      error,
      messages,
      options.botId,
      regenerate,
      sendMessage,
      setMessages,
      status,
      stop,
    ],
  );

  return helpers;
}
