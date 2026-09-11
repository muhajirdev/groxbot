import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import {
  officeUserFromActor,
  withOfficeUserMetadata,
} from "@groxbot/contracts";
import {
  lastProjectedPreview,
  parseOfficePendingActions,
  type OfficePendingAction,
  type PiBoundMessage,
  projectPiBoundMessages,
} from "@groxbot/core/browser";
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
import { patchBot } from "../lib/collections";
import { createWorkspaceAttachmentAdapter } from "../lib/computer-attachment";
import { composerBannerError, userFacingError } from "../lib/errors";
import { FIRST_TASK } from "../lib/jobs";
import { OfficeApprovalActionsContext } from "../lib/office-approval-actions";
import { OfficeAskActionsContext } from "../lib/office-ask-actions";
import { peekOfficeMessages, setOfficeMessages } from "../lib/office-messages";
import { orpc, queryClient } from "../lib/orpc";
import { client } from "../lib/rpc";
import { OFFICE_WORKING, patchThreadMeta } from "../lib/thread-cache";
import { cacheHiredTeammate } from "../lib/session";
import { createImmediateSteerQueue } from "../lib/thread-steer-queue";
import { useOfficeChat } from "../lib/use-office-chat";
import { projectedToThreadMessage } from "../lib/use-pi-thread";
import { cn } from "../lib/utils";
import { Button } from "../ui";
import { AskToolUI } from "./AskToolUI";
import { OfficeApprovalCard } from "./OfficeApprovalCard";
import { PresentToolUI } from "./PresentToolUI";
import { StampAppToolUI } from "./StampAppToolUI";

function rememberPreview(
  botId: string,
  roomId: string,
  messages: PiBoundMessage[],
) {
  setOfficeMessages(roomId, messages);
  const preview = lastProjectedPreview(projectPiBoundMessages(messages));
  if (!preview) return;
  patchBot(botId, { lastPreview: preview });
}

function OfficeWelcome() {
  return (
    <p className="px-1 text-left text-[14px] leading-relaxed text-muted-foreground">
      Empty desk. Tell them what to own — a job description or a few bullets —
      then send.
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
  needsHostedPlan?: boolean;
  placeholder: string;
  error: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  opening?: boolean;
  active?: boolean;
  onNeedsModel: () => void;
  onNeedsHostedPlan?: () => void;
  onUnarchive: (botId: string) => void;
  onAppFocus?: (threadId: string, appId: string) => void;
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
      needsHostedPlan={props.needsHostedPlan}
      placeholder={props.placeholder}
      error={props.error}
      userId={props.userId}
      userName={props.userName}
      userImage={props.userImage}
      opening={props.opening}
      active={props.active}
      onError={onError}
      onNeedsModel={props.onNeedsModel}
      onNeedsHostedPlan={props.onNeedsHostedPlan}
      onUnarchive={onUnarchive}
      onAppFocus={props.onAppFocus}
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
  needsHostedPlan?: boolean;
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
  onNeedsHostedPlan?: () => void;
  onUnarchive: () => void;
  onAppFocus?: (threadId: string, appId: string) => void;
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
        needsHostedPlan={props.needsHostedPlan}
        placeholder={props.placeholder}
        error={props.error}
        userId={props.userId}
        userName={props.userName}
        userImage={props.userImage}
        opening={props.opening}
        active={active}
        onError={props.onError}
        onNeedsModel={props.onNeedsModel}
        onNeedsHostedPlan={props.onNeedsHostedPlan}
        onAppFocus={props.onAppFocus}
        stopHolder={stopHolder}
      />
      {active && (props.error || props.archived) ? (
        <div className="px-5 pt-2 pb-4">
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
  needsHostedPlan?: boolean;
  placeholder: string;
  error: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  opening?: boolean;
  active?: boolean;
  onError: (error: string) => void;
  onNeedsModel: () => void;
  onNeedsHostedPlan?: () => void;
  onAppFocus?: (threadId: string, appId: string) => void;
  stopHolder: MutableRefObject<(() => void) | null>;
}) {
  const onErrorRef = useRef(props.onError);
  onErrorRef.current = props.onError;
  const onNeedsModelRef = useRef(props.onNeedsModel);
  onNeedsModelRef.current = props.onNeedsModel;
  const onNeedsHostedPlanRef = useRef(props.onNeedsHostedPlan);
  onNeedsHostedPlanRef.current = props.onNeedsHostedPlan;
  const archivedRef = useRef(props.archived);
  archivedRef.current = props.archived;
  const needsModelRef = useRef(props.needsModel);
  needsModelRef.current = props.needsModel;
  const needsHostedPlanRef = useRef(Boolean(props.needsHostedPlan));
  needsHostedPlanRef.current = Boolean(props.needsHostedPlan);
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
    connected,
    focusedAppId,
    pendingApprovals: loadPendingApprovals,
    approveApproval,
    rejectApproval,
    answerAsk,
    skipAsk,
  } = chat;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const busy = status === "submitted" || status === "streaming" || isStreaming;
  const wasBusy = useRef(false);
  const [pending, setPending] = useState(false);
  const abortSendRef = useRef<AbortController | null>(null);
  const inFlight = busy || pending;
  const [approvals, setApprovals] = useState<OfficePendingAction[]>([]);
  const [resolvingApproval, setResolvingApproval] = useState("");

  useEffect(() => {
    if (!props.active) return;
    props.onAppFocus?.(chatId, focusedAppId);
  }, [props.active, chatId, focusedAppId, props.onAppFocus]);

  const refreshApprovals = useCallback(async () => {
    try {
      setApprovals(parseOfficePendingActions(await loadPendingApprovals()));
    } catch {
      // The next status update or poll will retry after a reconnect.
    }
  }, [loadPendingApprovals]);

  useEffect(() => {
    if (!connected) return;
    void refreshApprovals();
    const ms = inFlight ? 800 : 3_000;
    const timer = window.setInterval(() => void refreshApprovals(), ms);
    return () => window.clearInterval(timer);
  }, [connected, inFlight, refreshApprovals, status]);

  const resolveApproval = useCallback(
    async (action: OfficePendingAction, approved: boolean) => {
      setResolvingApproval(action.executionId);
      try {
        if (approved) {
          const result = await approveApproval(action.executionId);
          await cacheHiredTeammate(result);
        } else {
          await rejectApproval(action.executionId, action.seq);
        }
      } catch (caught) {
        onErrorRef.current(
          userFacingError(
            caught,
            approved ? "Could not hire that teammate." : "Could not reject.",
          ),
        );
      } finally {
        setResolvingApproval("");
        await refreshApprovals();
      }
    },
    [approveApproval, refreshApprovals, rejectApproval],
  );

  const approvalActions = useMemo(
    () => ({
      approve: (action: OfficePendingAction) => resolveApproval(action, true),
      reject: (action: OfficePendingAction) => resolveApproval(action, false),
    }),
    [resolveApproval],
  );

  const askActions = useMemo(
    () => ({
      answer: async (toolCallId: string, answers: unknown) => {
        try {
          await answerAsk(toolCallId, answers);
        } catch {
          // Already answered or the socket dropped.
        }
      },
      skip: async (toolCallId: string) => {
        try {
          await skipAsk(toolCallId);
        } catch {
          // Already skipped or the socket dropped.
        }
      },
    }),
    [answerAsk, skipAsk],
  );

  const send = useCallback(
    async (message: Parameters<typeof onNew>[0]) => {
      if (archivedRef.current) {
        return Promise.reject(new Error("Archived"));
      }
      if (needsHostedPlanRef.current) {
        onNeedsHostedPlanRef.current?.();
        return Promise.reject(new Error("Hosted plan required"));
      }
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
      const preview =
        typeof message.content === "string"
          ? message.content
          : Array.isArray(message.content)
            ? message.content
                .flatMap((part) =>
                  part &&
                  typeof part === "object" &&
                  part.type === "text" &&
                  typeof part.text === "string"
                    ? [part.text]
                    : [],
                )
                .join(" ")
            : "";
      if (preview.trim()) {
        patchBot(botIdRef.current, {
          lastPreview: preview.trim().slice(0, 140),
        });
      }

      const abort = new AbortController();
      abortSendRef.current = abort;
      setPending(true);
      patchThreadMeta(botIdRef.current, { working: OFFICE_WORKING });

      try {
        if (archivedRef.current) {
          throw new Error("Archived");
        }
        return await onNew(message, stamped.metadata);
      } finally {
        if (abortSendRef.current === abort) abortSendRef.current = null;
        setPending(false);
      }
    },
    [onNew],
  );

  const sendRef = useRef(send);
  sendRef.current = send;
  const queue = useMemo(
    () => createImmediateSteerQueue((message) => sendRef.current(message)),
    [],
  );

  const halt = useCallback(() => {
    abortSendRef.current?.abort();
    return stop();
  }, [stop]);

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
  const runtime = useExternalStoreRuntime({
    messages: projected,
    convertMessage: projectedToThreadMessage,
    isRunning: inFlight,
    onNew: send,
    onCancel: halt,
    queue,
    adapters: { attachments },
  });

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
    connectionError: connectionError?.message || "",
    persisted: props.error,
    needsModel: props.needsModel,
    warming: opening || !connected,
  });
  useEffect(() => {
    if (banner === props.error) return;
    onErrorRef.current(banner);
  }, [banner, props.error]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AssistantRuntimeProvider runtime={runtime}>
        <OfficeAskActionsContext.Provider value={askActions}>
          <OfficeApprovalActionsContext.Provider value={approvalActions}>
            <PresentToolUI />
            <StampAppToolUI />
            <AskToolUI />
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
                approvals={
                  approvals.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {approvals.map((action) => (
                        <OfficeApprovalCard
                          key={`${action.executionId}:${action.seq}`}
                          action={action}
                          resolving={resolvingApproval === action.executionId}
                        />
                      ))}
                    </div>
                  ) : null
                }
              />
            </div>
          </OfficeApprovalActionsContext.Provider>
        </OfficeAskActionsContext.Provider>
      </AssistantRuntimeProvider>
    </div>
  );
});
