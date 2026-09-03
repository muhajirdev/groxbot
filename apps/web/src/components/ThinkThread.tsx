import { useAISDKRuntime } from "@assistant-ui/ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import {
  officeUserFromActor,
  withOfficeUserMetadata,
} from "@groxbot/contracts";
import { useAgent } from "agents/react";
import type { UIMessage } from "ai";
import {
  type MutableRefObject,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
import { peekThinkMessages, setThinkMessages } from "../lib/think-messages";
import { patchThreadMeta, THINK_WORKING } from "../lib/thread-cache";
import { cn } from "../lib/utils";
import { Button } from "../ui";
import { PresentToolUI } from "./PresentToolUI";

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

const THREAD_COMPONENTS = { Welcome: ThinkWelcome };

export const KeptThinkThread = memo(function KeptThinkThread(props: {
  botId: string;
  botName: string;
  archived: boolean;
  needsModel: boolean;
  placeholder: string;
  error: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  opening?: boolean;
  active?: boolean;
  onNeedsModel: () => void;
  onUnarchive: (botId: string) => void;
  stopRef: MutableRefObject<(() => void) | null>;
}) {
  const onError = useCallback(
    (message: string) => patchThreadMeta(props.botId, { error: message }),
    [props.botId],
  );
  const onUnarchive = useCallback(() => {
    props.onUnarchive(props.botId);
  }, [props.botId, props.onUnarchive]);
  return (
    <ThinkThread
      botId={props.botId}
      botName={props.botName}
      archived={props.archived}
      needsModel={props.needsModel}
      placeholder={props.placeholder}
      error={props.error}
      userId={props.userId}
      userName={props.userName}
      userImage={props.userImage}
      opening={props.opening}
      active={props.active}
      onError={onError}
      onNeedsModel={props.onNeedsModel}
      onUnarchive={onUnarchive}
      stopRef={props.stopRef}
    />
  );
});

export function ThinkThread(props: {
  botId: string;
  botName: string;
  archived: boolean;
  needsModel: boolean;
  placeholder: string;
  error: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  /** Catalog insert still in flight — show the composer, delay the socket. */
  opening?: boolean;
  /**
   * Keep-alive pool: inactive threads stay mounted (cached chat) but do not
   * own focus / stopRef. Sockets stay up so return visits skip remount cost.
   */
  active?: boolean;
  onError: (error: string) => void;
  onNeedsModel: () => void;
  onUnarchive: () => void;
  stopRef: MutableRefObject<(() => void) | null>;
}) {
  const active = props.active !== false;
  const stopHolder = useRef<(() => void) | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!active) return;
    const stopRef = props.stopRef;
    stopRef.current = () => stopHolder.current?.();
    return () => {
      if (stopRef.current) stopRef.current = null;
    };
  }, [active, props.stopRef]);

  useLayoutEffect(() => {
    if (!active || props.archived) return;
    const input = slotRef.current?.querySelector<HTMLElement>(
      '[aria-label="Message input"]',
    );
    input?.focus({ preventScroll: true });
  }, [active, props.archived]);

  return (
    <div
      ref={slotRef}
      className={cn(
        "absolute inset-0 flex min-h-0 flex-col",
        active ? "z-[1]" : "invisible pointer-events-none z-0",
      )}
      aria-hidden={!active}
    >
      <ThinkThreadRuntime
        botId={props.botId}
        botName={props.botName}
        archived={props.archived}
        needsModel={props.needsModel}
        placeholder={props.placeholder}
        error={props.error}
        userId={props.userId}
        userName={props.userName}
        userImage={props.userImage}
        opening={props.opening}
        onError={props.onError}
        onNeedsModel={props.onNeedsModel}
        stopHolder={stopHolder}
      />
      {active && (props.error || props.archived) ? (
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

const ThinkThreadRuntime = memo(function ThinkThreadRuntime(props: {
  botId: string;
  botName: string;
  archived: boolean;
  needsModel: boolean;
  placeholder: string;
  error: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  opening?: boolean;
  onError: (error: string) => void;
  onNeedsModel: () => void;
  stopHolder: MutableRefObject<(() => void) | null>;
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
  const sender = officeUserFromActor({
    userId: props.userId ?? "",
    name: props.userName ?? "",
    image: props.userImage,
  });
  const senderRef = useRef(sender);
  senderRef.current = sender;
  const seed = useRef(peekThinkMessages(props.botId) ?? []).current;
  const opening = Boolean(props.opening);

  const agent = useAgent({
    agent: "BotActor",
    name: props.botId,
    // Stay connected while mounted so switching back is a visibility toggle,
    // not a full Think remount + get-messages hydrate.
    enabled: !opening,
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

  const ready = agent.ready;
  const send = useCallback(
    async (...args: Parameters<typeof sendMessage>) => {
      await ready;
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
      const [payload, ...rest] = args;
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
      return sendMessage(
        withOfficeUserMetadata(payload, senderRef.current) as typeof payload,
        ...rest,
      );
    },
    [ready, sendMessage],
  );

  const helpers = useMemo(() => ({ ...chat, sendMessage: send }), [chat, send]);
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
    props.stopHolder.current = stop;
    return () => {
      if (props.stopHolder.current === stop) props.stopHolder.current = null;
    };
  }, [props.stopHolder, stop]);

  useEffect(() => {
    patchThreadMeta(props.botId, {
      working: busy ? THINK_WORKING : "",
    });
    return () => {
      patchThreadMeta(props.botId, { working: "" });
    };
  }, [busy, props.botId]);

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
    connectionError: opening ? "" : connectionError?.message || "",
    persisted: props.error,
  });
  useEffect(() => {
    if (banner === props.error) return;
    onErrorRef.current(banner);
  }, [banner, props.error]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AssistantRuntimeProvider runtime={runtime}>
        <PresentToolUI />
        <div className="flex min-h-0 flex-1 flex-col">
          <Thread
            autoFocus={false}
            hideComposer={props.archived}
            placeholder={props.placeholder || FIRST_TASK}
            viewerUserId={props.userId}
            viewerImage={props.userImage}
            botName={props.botName}
            components={THREAD_COMPONENTS}
          />
        </div>
      </AssistantRuntimeProvider>
    </div>
  );
});
