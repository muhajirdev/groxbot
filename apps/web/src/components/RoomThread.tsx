import { AssistantRuntimeProvider, useExternalStoreRuntime } from "@assistant-ui/react";
import {
  officeUserFromActor,
  withOfficeUserMetadata,
} from "@groxbot/contracts";
import type { PiBoundMessage } from "@groxbot/core/browser";
import {
  type MutableRefObject,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { composerBannerError } from "../lib/errors";
import { FIRST_TASK } from "../lib/jobs";
import { peekRoomMessages, setRoomMessages } from "../lib/room-messages";
import { patchThreadMeta, OFFICE_WORKING } from "../lib/thread-cache";
import { useRoomChat } from "../lib/use-room-chat";
import { projectedToThreadMessage } from "../lib/use-pi-thread";
import { cn } from "../lib/utils";
import { PresentToolUI } from "./PresentToolUI";

function rememberPreview(roomId: string, messages: PiBoundMessage[]) {
  setRoomMessages(roomId, messages);
}

function RoomWelcome() {
  return (
    <p className="px-1 text-left text-[13px] leading-normal text-muted-foreground">
      This log is the table. Say something and everyone answers. @name
      someone to talk to one person.
    </p>
  );
}

const THREAD_COMPONENTS = { Welcome: RoomWelcome };

export const KeptRoomThread = memo(function KeptRoomThread(props: {
  roomId: string;
  roomName: string;
  targetBotId?: string;
  targetName?: string;
  needsModel: boolean;
  placeholder: string;
  error: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  active?: boolean;
  onNeedsModel: () => void;
  stopRef: MutableRefObject<(() => void) | null>;
}) {
  const onError = useCallback(
    (message: string) => patchThreadMeta(props.roomId, { error: message }),
    [props.roomId],
  );
  return (
    <RoomThread
      roomId={props.roomId}
      roomName={props.roomName}
      targetBotId={props.targetBotId}
      targetName={props.targetName}
      needsModel={props.needsModel}
      placeholder={props.placeholder}
      error={props.error}
      userId={props.userId}
      userName={props.userName}
      userImage={props.userImage}
      active={props.active}
      onError={onError}
      onNeedsModel={props.onNeedsModel}
      stopRef={props.stopRef}
    />
  );
});

export function RoomThread(props: {
  roomId: string;
  roomName: string;
  targetBotId?: string;
  targetName?: string;
  needsModel: boolean;
  placeholder: string;
  error: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  active?: boolean;
  onError: (error: string) => void;
  onNeedsModel: () => void;
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
    if (!active) return;
    const input = slotRef.current?.querySelector<HTMLElement>(
      '[aria-label="Message input"]',
    );
    input?.focus({ preventScroll: true });
  }, [active]);

  return (
    <div
      ref={slotRef}
      className={cn(
        "absolute inset-0 flex min-h-0 flex-col",
        active ? "z-[1]" : "invisible pointer-events-none z-0",
      )}
      aria-hidden={!active}
    >
      <RoomThreadRuntime
        roomId={props.roomId}
        roomName={props.roomName}
        targetBotId={props.targetBotId}
        targetName={props.targetName}
        needsModel={props.needsModel}
        placeholder={props.placeholder}
        error={props.error}
        userId={props.userId}
        userName={props.userName}
        userImage={props.userImage}
        onError={props.onError}
        onNeedsModel={props.onNeedsModel}
        stopHolder={stopHolder}
      />
      {active && props.error ? (
        <div className="px-5 pt-2 pb-[18px]">
          <p className="mb-2 text-[13px] text-danger">{props.error}</p>
        </div>
      ) : null}
    </div>
  );
}

const RoomThreadRuntime = memo(function RoomThreadRuntime(props: {
  roomId: string;
  roomName: string;
  targetBotId?: string;
  targetName?: string;
  needsModel: boolean;
  placeholder: string;
  error: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  onError: (error: string) => void;
  onNeedsModel: () => void;
  stopHolder: MutableRefObject<(() => void) | null>;
}) {
  const onErrorRef = useRef(props.onError);
  onErrorRef.current = props.onError;
  const onNeedsModelRef = useRef(props.onNeedsModel);
  onNeedsModelRef.current = props.onNeedsModel;
  const needsModelRef = useRef(props.needsModel);
  needsModelRef.current = props.needsModel;
  const roomIdRef = useRef(props.roomId);
  roomIdRef.current = props.roomId;
  const sender = officeUserFromActor({
    userId: props.userId ?? "",
    name: props.userName ?? "",
    image: props.userImage,
  });
  const senderRef = useRef(sender);
  senderRef.current = sender;
  const seed = useRef(peekRoomMessages(props.roomId) ?? []).current;

  const chat = useRoomChat({
    roomId: props.roomId,
    targetBotId: props.targetBotId,
    seed,
  });
  const {
    messages,
    projected,
    status,
    stop,
    error,
    onNew,
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
    async (message: Parameters<typeof onNew>[0]) => {
      if (needsModelRef.current) {
        onNeedsModelRef.current();
        onErrorRef.current(
          "Add a model key, or use Groxbot’s included gateway, to talk to teammates.",
        );
        return Promise.reject(new Error("Model required"));
      }
      const stamped = withOfficeUserMetadata(
        { role: "user", metadata: message.metadata },
        senderRef.current,
      ) as { metadata?: unknown };

      const abort = new AbortController();
      abortSendRef.current = abort;
      setPending(true);
      patchThreadMeta(roomIdRef.current, { working: OFFICE_WORKING });

      try {
        setPending(false);
        return await onNew(message, stamped.metadata);
      } finally {
        if (abortSendRef.current === abort) abortSendRef.current = null;
        setPending(false);
      }
    },
    [onNew],
  );

  const halt = useCallback(() => {
    abortSendRef.current?.abort();
    return stop();
  }, [stop]);

  const runtime = useExternalStoreRuntime({
    messages: projected,
    convertMessage: projectedToThreadMessage,
    isRunning: inFlight,
    onNew: send,
    onCancel: halt,
  });

  useEffect(() => {
    props.stopHolder.current = halt;
    return () => {
      if (props.stopHolder.current === halt) props.stopHolder.current = null;
    };
  }, [props.stopHolder, halt]);

  useEffect(() => {
    patchThreadMeta(props.roomId, {
      working: inFlight ? OFFICE_WORKING : "",
    });
    return () => {
      patchThreadMeta(props.roomId, { working: "" });
    };
  }, [inFlight, props.roomId]);

  useEffect(() => {
    if (wasBusy.current && !busy) {
      rememberPreview(props.roomId, messagesRef.current);
    }
    wasBusy.current = busy;
  }, [busy, props.roomId]);

  useEffect(() => {
    return () => {
      rememberPreview(props.roomId, messagesRef.current);
    };
  }, [props.roomId]);

  const banner = composerBannerError({
    inFlight,
    agentError: error?.message || "",
    connectionError: connectionError?.message || "",
    persisted: props.error,
    needsModel: props.needsModel,
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
            placeholder={props.placeholder || FIRST_TASK}
            viewerUserId={props.userId}
            viewerImage={props.userImage}
            botName={props.targetName || props.roomName}
            pending={pending}
            components={THREAD_COMPONENTS}
          />
        </div>
      </AssistantRuntimeProvider>
    </div>
  );
});
