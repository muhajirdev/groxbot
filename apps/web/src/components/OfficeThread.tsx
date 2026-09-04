import { useAISDKRuntime } from "@assistant-ui/ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  officeUserFromActor,
  withOfficeUserMetadata,
} from "@groxbot/contracts";
import type { UIMessage } from "ai";
import {
  type MutableRefObject,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { lastOfficePreview } from "../lib/chat-messages";
import { patchBot } from "../lib/collections";
import { createWorkspaceAttachmentAdapter } from "../lib/computer-attachment";
import { composerBannerError } from "../lib/errors";
import { FIRST_TASK } from "../lib/jobs";
import { peekOfficeMessages, setOfficeMessages } from "../lib/office-messages";
import { orpc, queryClient } from "../lib/orpc";
import {
  seedOutgoingUserMessage,
  textFromOutgoingPayload,
} from "../lib/outgoing-user-message";
import { client } from "../lib/rpc";
import { OFFICE_WORKING, patchThreadMeta } from "../lib/thread-cache";
import { useOfficeChat } from "../lib/use-office-chat";
import { cn } from "../lib/utils";
import { Button } from "../ui";
import { PresentToolUI } from "./PresentToolUI";

function rememberPreview(botId: string, roomId: string, messages: UIMessage[]) {
  setOfficeMessages(roomId, messages);
  const preview = lastOfficePreview(messages);
  if (!preview) return;
  patchBot(botId, { lastPreview: preview });
}

function OfficeWelcome() {
  return (
    <p className="px-1 text-left text-[13px] leading-normal text-muted-foreground">
      First message is a real task. A good handoff has an outcome, sources, and
      when to stop.
    </p>
  );
}

const THREAD_COMPONENTS = { Welcome: OfficeWelcome };

export const KeptOfficeThread = memo(function KeptOfficeThread(props: {
  botId: string;
  roomId?: string;
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
    <OfficeThread
      botId={props.botId}
      roomId={props.roomId}
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

export function OfficeThread(props: {
  botId: string;
  roomId?: string;
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
      <OfficeThreadRuntime
        botId={props.botId}
        roomId={props.roomId}
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

const OfficeThreadRuntime = memo(function OfficeThreadRuntime(props: {
  botId: string;
  roomId?: string;
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
  const chatId = props.roomId || props.botId;
  const seed = useRef(peekOfficeMessages(chatId) ?? []).current;
  const opening = Boolean(props.opening);

  const chat = useOfficeChat({
    botId: chatId,
    enabled: !opening,
    seed,
  });
  const {
    messages,
    status,
    stop,
    error,
    sendMessage,
    setMessages,
    isStreaming,
    connectionError,
  } = chat;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const busy = status === "submitted" || status === "streaming" || isStreaming;
  const wasBusy = useRef(false);
  const [pending, setPending] = useState(false);
  const abortSendRef = useRef<AbortController | null>(null);
  const inFlight = busy || pending;

  const send = useCallback(
    async (...args: Parameters<typeof sendMessage>) => {
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
      const [payload] = args;
      const labeled = withOfficeUserMetadata(
        payload,
        senderRef.current,
      ) as typeof payload;
      const preview = textFromOutgoingPayload(labeled);
      if (preview) {
        patchBot(botIdRef.current, { lastPreview: preview.slice(0, 140) });
      }

      const abort = new AbortController();
      abortSendRef.current = abort;
      setPending(true);
      patchThreadMeta(botIdRef.current, { working: OFFICE_WORKING });

      const seededId = crypto.randomUUID();
      const seeded = seedOutgoingUserMessage(labeled, seededId);
      if (seeded) {
        setMessages((current) =>
          current.some((message) => message.id === seededId)
            ? current
            : [...current, seeded],
        );
      }

      let handedOff = false;
      try {
        if (archivedRef.current) {
          throw new Error("Archived");
        }
        handedOff = true;
        setPending(false);
        return await sendMessage(
          seeded
            ? ({
                ...labeled,
                messageId: seededId,
              } as typeof payload)
            : labeled,
        );
      } catch (caught) {
        if (!handedOff && seeded) {
          setMessages((current) =>
            current.filter((message) => message.id !== seededId),
          );
        }
        throw caught;
      } finally {
        if (abortSendRef.current === abort) abortSendRef.current = null;
        setPending(false);
      }
    },
    [sendMessage, setMessages],
  );

  const halt = useCallback(() => {
    abortSendRef.current?.abort();
    return stop();
  }, [stop]);

  const helpers = useMemo(
    () => ({ ...chat, sendMessage: send, stop: halt }),
    [chat, send, halt],
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
    props.stopHolder.current = halt;
    return () => {
      if (props.stopHolder.current === halt) props.stopHolder.current = null;
    };
  }, [props.stopHolder, halt]);

  useEffect(() => {
    patchThreadMeta(props.botId, {
      working: inFlight ? OFFICE_WORKING : "",
    });
    return () => {
      patchThreadMeta(props.botId, { working: "" });
    };
  }, [inFlight, props.botId]);

  useEffect(() => {
    if (wasBusy.current && !busy) {
      rememberPreview(props.botId, chatId, messagesRef.current);
    }
    wasBusy.current = busy;
  }, [busy, chatId, props.botId]);

  useEffect(() => {
    return () => {
      rememberPreview(props.botId, chatId, messagesRef.current);
    };
  }, [chatId, props.botId]);

  const banner = composerBannerError({
    inFlight,
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
            pending={pending}
            components={THREAD_COMPONENTS}
          />
        </div>
      </AssistantRuntimeProvider>
    </div>
  );
});
