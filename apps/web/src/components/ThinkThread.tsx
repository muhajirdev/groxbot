import { useAISDKRuntime } from "@assistant-ui/ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import type { UIMessage } from "ai";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { lastThinkPreview } from "../lib/chat-messages";
import { patchBot } from "../lib/collections";
import { createWorkspaceAttachmentAdapter } from "../lib/computer-attachment";
import { composerBannerError } from "../lib/errors";
import { agentSocketHost } from "../lib/host";
import { FIRST_TASK } from "../lib/jobs";
import { orpc, queryClient } from "../lib/orpc";
import { client } from "../lib/rpc";
import {
  fetchThinkMessages,
  peekThinkMessages,
  setThinkMessages,
  thinkAgentHttpUrl,
} from "../lib/think-messages";
import { Button } from "../ui";
import { TypingDots } from "./TypingDots";

function rememberPreview(botId: string, messages: UIMessage[]) {
  setThinkMessages(botId, messages);
  const preview = lastThinkPreview(messages);
  if (!preview) return;
  patchBot(botId, { lastPreview: preview });
}

function ThinkWelcome() {
  return (
    <p className="px-1 text-left text-[13px] leading-normal text-muted-foreground">
      First message is a real task. A good handoff has an outcome, sources, and
      when to stop.
    </p>
  );
}

export function ThinkThread(props: {
  botId: string;
  botName: string;
  archived: boolean;
  needsModel: boolean;
  placeholder: string;
  error: string;
  onBusy: (busy: boolean) => void;
  onError: (error: string) => void;
  onNeedsModel: () => void;
  onUnarchive: () => void;
  stopRef: MutableRefObject<(() => void) | null>;
}) {
  const host = agentSocketHost();
  const onErrorRef = useRef(props.onError);
  onErrorRef.current = props.onError;
  const onNeedsModelRef = useRef(props.onNeedsModel);
  onNeedsModelRef.current = props.onNeedsModel;
  const archivedRef = useRef(props.archived);
  archivedRef.current = props.archived;
  const needsModelRef = useRef(props.needsModel);
  needsModelRef.current = props.needsModel;
  const botIdRef = useRef(props.botId);
  botIdRef.current = props.botId;
  const [seed] = useState(() => peekThinkMessages(props.botId) ?? []);
  const [hydrating] = useState(
    () => peekThinkMessages(props.botId) === undefined,
  );
  const [waiting, setWaiting] = useState(hydrating);
  const dirty = useRef(false);

  const agent = useAgent({
    agent: "BotActor",
    name: props.botId,
    ...(host ? { host } : {}),
  });

  const chat = useAgentChat({
    agent,
    credentials: "include",
    syncMessagesToServer: false,
    getInitialMessages: null,
    messages: seed,
  });
  const {
    messages,
    setMessages,
    status,
    stop,
    error,
    sendMessage,
    isStreaming,
    connectionError,
  } = chat;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const busy = status === "submitted" || status === "streaming" || isStreaming;
  const wasBusy = useRef(false);

  const send = useCallback(
    (...args: Parameters<typeof sendMessage>) => {
      if (archivedRef.current) {
        return Promise.reject(new Error("Archived"));
      }
      if (needsModelRef.current) {
        onNeedsModelRef.current();
        onErrorRef.current(
          "Add a model key, or use Groxbot’s included gateway, to talk to teammates.",
        );
        return Promise.reject(new Error("Model required"));
      }
      dirty.current = true;
      const payload = args[0];
      const text =
        payload &&
        typeof payload === "object" &&
        "text" in payload &&
        typeof payload.text === "string"
          ? payload.text.trim()
          : "";
      if (text) {
        patchBot(botIdRef.current, { lastPreview: text.slice(0, 140) });
      }
      return sendMessage(...args);
    },
    [sendMessage],
  );

  const helpers = useMemo(
    () => ({ ...chat, sendMessage: send }),
    [chat, send],
  );
  const attachments = useMemo(
    () =>
      createWorkspaceAttachmentAdapter({
        write: (input) =>
          client.computer.write({ botId: props.botId, ...input }),
        onPlaced: () => {
          void queryClient.invalidateQueries({
            queryKey: orpc.computer.list.queryOptions({
              input: { botId: props.botId },
            }).queryKey,
          });
        },
      }),
    [props.botId],
  );
  const runtime = useAISDKRuntime(
    helpers as Parameters<typeof useAISDKRuntime>[0],
    { adapters: { attachments } },
  );

  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    void fetchThinkMessages(thinkAgentHttpUrl(props.botId)).then((next) => {
      if (cancelled) return;
      setWaiting(false);
      if (next === null || dirty.current) return;
      setMessages(next);
      rememberPreview(props.botId, next);
    });
    return () => {
      cancelled = true;
    };
  }, [waiting, props.botId, setMessages]);

  useEffect(() => {
    props.onBusy(busy);
    return () => {
      props.onBusy(false);
    };
  }, [busy, props.onBusy]);

  useEffect(() => {
    props.stopRef.current = stop;
    return () => {
      props.stopRef.current = null;
    };
  }, [props.stopRef, stop]);

  useEffect(() => {
    if (wasBusy.current && !busy) {
      rememberPreview(props.botId, messagesRef.current);
    }
    wasBusy.current = busy;
  }, [busy, props.botId]);

  useEffect(() => {
    return () => {
      rememberPreview(props.botId, messagesRef.current);
    };
  }, [props.botId]);

  const banner = composerBannerError({
    inFlight: busy,
    agentError: error?.message || "",
    connectionError: connectionError?.message || "",
    persisted: props.error,
  });
  useEffect(() => {
    if (banner === props.error) return;
    onErrorRef.current(banner);
  }, [banner, props.error]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {waiting ? (
        <div className="flex min-h-0 flex-1 flex-col justify-end px-7 pt-2.5 pb-6">
          <TypingDots label={`Loading ${props.botName}`} />
        </div>
      ) : (
        <AssistantRuntimeProvider runtime={runtime}>
          <div className="flex min-h-0 flex-1 flex-col">
            <Thread
              autoFocus={!props.archived}
              hideComposer={props.archived}
              placeholder={props.placeholder || FIRST_TASK}
              components={{ Welcome: ThinkWelcome }}
            />
          </div>
        </AssistantRuntimeProvider>
      )}
      {props.error || props.archived ? (
        <div className="px-5 pt-2 pb-[18px]">
          {props.error ? (
            <p className="mb-2 text-[13px] text-danger">{props.error}</p>
          ) : null}
          {props.archived ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-[13px]">
              <span>
                Archived. Unarchive to keep working with {props.botName}.
              </span>
              <Button variant="text" type="button" onClick={props.onUnarchive}>
                Unarchive
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
