import { useExternalStoreRuntime } from "@assistant-ui/core/react";
import {
  useActionBarCopy,
  useActionBarEdit,
  useActionBarReload,
} from "@assistant-ui/core/react";
import {
  AssistantRuntimeProvider,
  AttachmentPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  QueueItemPrimitive,
  type TextMessagePartComponent,
  ThreadPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import {
  type Bot,
  officeUserFromActor,
  PRESENT_TOOL_NAME,
  type Room,
  withOfficeUserMetadata,
} from "@groxbot/contracts";
import {
  OFFICE_ASK_TOOL_NAME,
  OFFICE_STAMP_APP_TOOL_NAME,
} from "@groxbot/core/browser";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { showActionSheet } from "../lib/action-sheet";
import { appCardsFromOfficeMessage } from "../lib/app-cards";
import {
  approvalSummary,
  type PendingApproval,
  parsePendingApprovals,
} from "../lib/approvals";
import { createWorkspaceAttachmentAdapter } from "../lib/attachment-adapter";
import { sessionCookie } from "../lib/auth";
import { lastUiPreview } from "../lib/chat-messages";
import { composerBannerError } from "../lib/errors";
import { officeAppUrl } from "../lib/host";
import { peekOfficeMessages, setOfficeMessages } from "../lib/office-cache";
import { officeUserMessageSender } from "../lib/office-sender";
import { orpc, queryClient } from "../lib/orpc";
import { pickOfficeFiles, pickOfficePhotos } from "../lib/pick-file";
import type { RoomMentionSeat } from "../lib/room-mention";
import { client } from "../lib/rpc";
import { createImmediateSteerQueue } from "../lib/thread-steer-queue";
import { isWaitingForAssistantTurn } from "../lib/thread-waiting";
import { useOfficeChat } from "../lib/use-office-chat";
import { projectedToThreadMessage } from "../lib/use-pi-thread";
import { tapMedium, tapSoft, tapSuccess } from "../lib/haptics";
import { officeQueryKey } from "../lib/workspace-switch";
import { colors, radius } from "../theme";
import { useSetWorking } from "../working";
import { AppCard } from "./AppCard";
import { AskCard, OfficeAskActionsContext } from "./AskCard";
import { Avatar } from "./Avatar";
import { ChatMarkdown } from "./ChatMarkdown";
import { EmptyDesk } from "./EmptyDesk";
import { usePressScale } from "./Motion";
import { OfficeSkillSlash } from "./OfficeSkillSlash";
import { PresentCard } from "./PresentCard";
import { RoomMentionMenu } from "./RoomMentionMenu";

async function copyToClipboard(text: string) {
  const didCopy = await Clipboard.setStringAsync(text);
  if (!didCopy) throw new Error("Clipboard write failed");
}

export function OfficeThread(props: {
  botId: string;
  roomId?: string;
  botName: string;
  archived: boolean;
  needsModel: boolean;
  placeholder?: string;
  description?: string;
  avatarColor?: string;
  avatarShape?: string;
  kind?: "office" | "room";
  members?: readonly RoomMentionSeat[];
  targetBotId?: string;
  userId?: string;
  userName?: string;
  onNeedsModel: () => void;
  onOpenPath?: (path: string) => void;
  onUnarchive: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <View style={styles.fill}>
      <OfficeThreadRuntime
        botId={props.botId}
        roomId={props.roomId}
        botName={props.botName}
        archived={props.archived}
        needsModel={props.needsModel}
        placeholder={
          props.placeholder ||
          (props.kind === "room" ? "Message" : `Ask ${props.botName}`)
        }
        description={props.description}
        avatarColor={props.avatarColor}
        avatarShape={props.avatarShape}
        kind={props.kind ?? "office"}
        members={props.members ?? []}
        targetBotId={props.targetBotId}
        userId={props.userId}
        userName={props.userName}
        error={error}
        onError={setError}
        onNeedsModel={props.onNeedsModel}
        onOpenPath={props.onOpenPath}
      />
      {error ? <Text style={styles.banner}>{error}</Text> : null}
      {props.archived ? (
        <View style={styles.archived}>
          <Text style={styles.archivedCopy}>
            Archived. Unarchive to keep working with {props.botName}.
          </Text>
          <Pressable onPress={props.onUnarchive} accessibilityRole="button">
            <Text style={styles.link}>Unarchive</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function OfficeThreadRuntime(props: {
  botId: string;
  roomId?: string;
  botName: string;
  archived: boolean;
  needsModel: boolean;
  placeholder: string;
  description?: string;
  avatarColor?: string;
  avatarShape?: string;
  kind: "office" | "room";
  members: readonly RoomMentionSeat[];
  targetBotId?: string;
  userId?: string;
  userName?: string;
  error: string;
  onError: (error: string) => void;
  onNeedsModel: () => void;
  onOpenPath?: (path: string) => void;
}) {
  const [cookie, setCookie] = useState("");
  useEffect(() => {
    void sessionCookie().then(setCookie);
  }, []);
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
  });
  const senderRef = useRef(sender);
  senderRef.current = sender;
  const setWorking = useSetWorking();
  const chatId = props.roomId || props.botId;
  const seed = useRef(peekOfficeMessages(chatId) ?? []).current;

  const chat = useOfficeChat({
    botId: props.botId,
    roomId: props.roomId,
    targetBotId: props.targetBotId,
    cookie,
    seed,
  });
  const {
    status,
    stop,
    error,
    onNew,
    projected,
    messages,
    isStreaming,
    connectionError,
    connected,
    pendingApprovals: loadPendingApprovals,
    approveApproval,
    rejectApproval,
    answerAsk,
    skipAsk,
  } = chat;
  const busy = status === "submitted" || status === "streaming" || isStreaming;
  const [pending, setPending] = useState(false);
  const abortSendRef = useRef<AbortController | null>(null);
  const inFlight = busy || pending;

  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [resolvingApproval, setResolvingApproval] = useState("");

  const refreshApprovals = useCallback(async () => {
    try {
      setApprovals(parsePendingApprovals(await loadPendingApprovals()));
    } catch {
      // Reconnect will retry.
    }
  }, [loadPendingApprovals]);

  useEffect(() => {
    if (!connected) return;
    void refreshApprovals();
    const timer = setInterval(() => void refreshApprovals(), 3_000);
    return () => clearInterval(timer);
  }, [connected, refreshApprovals, status]);

  const resolveApproval = useCallback(
    async (action: PendingApproval, approved: boolean) => {
      setResolvingApproval(action.executionId);
      try {
        if (approved) await approveApproval(action.executionId);
        else await rejectApproval(action.executionId, action.seq);
      } finally {
        setResolvingApproval("");
        await refreshApprovals();
      }
    },
    [approveApproval, refreshApprovals, rejectApproval],
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
      setWorking(botIdRef.current, true);

      try {
        if (archivedRef.current) {
          throw new Error("Archived");
        }
        setPending(false);
        return await onNew(message, stamped.metadata);
      } finally {
        if (abortSendRef.current === abort) abortSendRef.current = null;
        setPending(false);
      }
    },
    [onNew, setWorking],
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
    setWorking(props.botId, inFlight);
    return () => setWorking(props.botId, false);
  }, [inFlight, props.botId, setWorking]);

  useEffect(() => {
    setOfficeMessages(chatId, messages);
    const preview = lastUiPreview(messages);
    if (!preview) return;
    queryClient.setQueryData<Bot[]>(
      officeQueryKey(orpc.bots.list.queryOptions().queryKey),
      (rows) => {
        if (!rows) return rows;
        return rows.map((row) =>
          row.id === props.botId || row.homeRoomId === chatId
            ? { ...row, lastPreview: preview }
            : row,
        );
      },
    );
    queryClient.setQueryData<Room[]>(
      officeQueryKey(orpc.rooms.list.queryOptions().queryKey),
      (rows) => {
        if (!rows) return rows;
        return rows.map((row) =>
          row.id === chatId ? { ...row, lastPreview: preview } : row,
        );
      },
    );
  }, [chatId, messages, props.botId]);

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

  useEffect(() => {
    return () => {
      abortSendRef.current?.abort();
      void halt();
    };
  }, [halt]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <OfficeAskActionsContext.Provider value={askActions}>
        {approvals.length > 0 ? (
          <View style={styles.approvals}>
            {approvals.map((action) => (
              <View key={action.executionId} style={styles.approval}>
                <Text style={styles.approvalCopy}>
                  {approvalSummary(action)}
                </Text>
                <View style={styles.approvalActions}>
                  <Pressable
                    disabled={resolvingApproval === action.executionId}
                    onPress={() => void resolveApproval(action, false)}
                  >
                    <Text style={styles.barLabel}>Skip</Text>
                  </Pressable>
                  <Pressable
                    disabled={resolvingApproval === action.executionId}
                    onPress={() => void resolveApproval(action, true)}
                  >
                    <Text style={styles.link}>Approve</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <OfficeThreadView
          botId={props.botId}
          botName={props.botName}
          hideComposer={props.archived}
          placeholder={props.placeholder}
          description={props.description}
          avatarColor={props.avatarColor}
          avatarShape={props.avatarShape}
          kind={props.kind}
          members={props.members}
          viewerUserId={props.userId}
          pending={pending}
          onOpenPath={props.onOpenPath}
        />
      </OfficeAskActionsContext.Provider>
    </AssistantRuntimeProvider>
  );
}

function OfficeThreadView(props: {
  botId: string;
  botName: string;
  hideComposer: boolean;
  placeholder: string;
  description?: string;
  avatarColor?: string;
  avatarShape?: string;
  kind: "office" | "room";
  members: readonly RoomMentionSeat[];
  viewerUserId?: string;
  pending?: boolean;
  onOpenPath?: (path: string) => void;
}) {
  const pending = Boolean(props.pending);
  useSendHaptic();
  return (
    <ThreadPrimitive.Root style={styles.fill}>
      <ThreadPrimitive.MessagesFlatList
        autoScroll
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.messages}
        ListHeaderComponent={
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <EmptyThread
              botName={props.botName}
              kind={props.kind}
              description={props.description}
              avatarColor={props.avatarColor}
              avatarShape={props.avatarShape}
            />
          </AuiIf>
        }
        ListFooterComponent={
          <>
            <AuiIf
              condition={(s) =>
                isWaitingForAssistantTurn({
                  isRunning: s.thread.isRunning,
                  pending,
                  lastMessage: s.thread.messages.at(-1),
                })
              }
            >
              <View style={styles.workingRow}>
                {props.avatarColor ? (
                  <Avatar
                    name={props.botName}
                    color={props.avatarColor}
                    shape={props.avatarShape || "circle"}
                    size={22}
                    working
                  />
                ) : (
                  <ActivityIndicator color={colors.accent} />
                )}
                <Text style={styles.workingCopy}>
                  {props.botName} is on it…
                </Text>
              </View>
            </AuiIf>
            <Followups />
          </>
        }
      >
        {() => (
          <ThreadMessage
            botId={props.botId}
            botName={props.botName}
            kind={props.kind}
            viewerUserId={props.viewerUserId}
            onOpenPath={props.onOpenPath}
          />
        )}
      </ThreadPrimitive.MessagesFlatList>
      {props.hideComposer ? null : (
        <Composer
          placeholder={props.placeholder}
          pending={pending}
          members={props.members}
        />
      )}
    </ThreadPrimitive.Root>
  );
}

const STARTERS = [
  {
    label: "Write my job",
    prompt:
      "Write a job description for yourself from what you know about this office. Keep it one page.",
  },
  {
    label: "What's on your desk?",
    prompt:
      "What's on your computer and in knowledge right now? Give me a short tour.",
  },
  {
    label: "Plan the week",
    prompt:
      "Help me plan the week. Ask what matters, then propose a tight list.",
  },
] as const;

function useSendHaptic() {
  const running = useAuiState((s) => s.thread.isRunning);
  const seen = useRef(running);
  useEffect(() => {
    if (running && !seen.current) tapSuccess();
    seen.current = running;
  }, [running]);
}

function EmptyThread(props: {
  botName: string;
  kind: "office" | "room";
  description?: string;
  avatarColor?: string;
  avatarShape?: string;
}) {
  const room = props.kind === "room";
  return (
    <EmptyDesk
      name={props.botName}
      color={props.avatarColor}
      shape={props.avatarShape}
      title={room ? props.botName : `Hey. I'm ${props.botName}.`}
      lede={
        room
          ? props.description?.trim() ||
            "This table is the log. Say something and everyone answers."
          : "Give me a real first task — an outcome, sources, and when to stop."
      }
    >
      {room ? null : (
        <View style={styles.starters}>
          {STARTERS.map((item) => (
            <ThreadPrimitive.Suggestion
              key={item.prompt}
              prompt={item.prompt}
              send
              style={styles.starter}
            >
              <Text style={styles.starterLabel}>{item.label}</Text>
            </ThreadPrimitive.Suggestion>
          ))}
        </View>
      )}
    </EmptyDesk>
  );
}

function Followups() {
  const suggestions = useAuiState((s) => s.thread.suggestions);
  const empty = useAuiState((s) => s.thread.isEmpty);
  const running = useAuiState((s) => s.thread.isRunning);
  if (empty || running || suggestions.length === 0) return null;
  return (
    <View style={styles.followups}>
      {suggestions.map((suggestion) => (
        <ThreadPrimitive.Suggestion
          key={suggestion.prompt}
          prompt={suggestion.prompt}
          send
          style={styles.followup}
        >
          <Text style={styles.followupLabel}>
            {suggestion.title || suggestion.prompt}
          </Text>
        </ThreadPrimitive.Suggestion>
      ))}
    </View>
  );
}

function useMessageMenu(role: "user" | "assistant") {
  const { copy, disabled: copyDisabled } = useActionBarCopy({
    copyToClipboard,
  });
  const { edit, disabled: editDisabled } = useActionBarEdit();
  const { reload, disabled: reloadDisabled } = useActionBarReload();
  return useCallback(() => {
    const items: { label: string; onPress?: () => void; cancel?: boolean }[] =
      [];
    if (!copyDisabled) {
      items.push({ label: "Copy", onPress: () => copy() });
    }
    if (role === "user" && !editDisabled) {
      items.push({ label: "Edit", onPress: edit });
    }
    if (role === "assistant" && !reloadDisabled) {
      items.push({ label: "Retry", onPress: () => reload() });
    }
    items.push({ label: "Cancel", cancel: true });
    if (items.length === 1) return;
    showActionSheet(undefined, items);
  }, [
    copy,
    copyDisabled,
    edit,
    editDisabled,
    reload,
    reloadDisabled,
    role,
  ]);
}

function ThreadMessage(props: {
  botId: string;
  botName: string;
  kind: "office" | "room";
  viewerUserId?: string;
  onOpenPath?: (path: string) => void;
}) {
  const role = useAuiState((s) => s.message.role);
  const editing = useAuiState((s) => s.message.composer.isEditing);
  if (editing) return <EditComposer />;
  if (role === "user") {
    return (
      <UserMessage
        kind={props.kind}
        viewerUserId={props.viewerUserId}
        onOpenPath={props.onOpenPath}
      />
    );
  }
  return (
    <AssistantMessage
      botId={props.botId}
      botName={props.botName}
      kind={props.kind}
      onOpenPath={props.onOpenPath}
    />
  );
}

function UserMessage(props: {
  kind: "office" | "room";
  viewerUserId?: string;
  onOpenPath?: (path: string) => void;
}) {
  const metadata = useAuiState((s) => s.message.metadata);
  const sender = officeUserMessageSender(metadata, props.viewerUserId);
  const showName = props.kind === "room" && sender;
  const onMenu = useMessageMenu("user");
  const UserText: TextMessagePartComponent = ({ text }) => (
    <ChatMarkdown text={text} officePaths onOpenPath={props.onOpenPath} />
  );
  return (
    <MessagePrimitive.Root style={styles.userWrap}>
      {showName ? <Text style={styles.who}>{sender?.label}</Text> : null}
      <Pressable
        onLongPress={onMenu}
        delayLongPress={350}
        accessibilityHint="Long press for Copy and Edit"
        style={styles.userBubble}
      >
        <MessagePrimitive.Parts components={{ Text: UserText }} />
      </Pressable>
      <MessagePrimitive.Attachments>
        {() => <AttachmentChip />}
      </MessagePrimitive.Attachments>
      <BranchPicker />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage(props: {
  botId: string;
  botName: string;
  kind: "office" | "room";
  onOpenPath?: (path: string) => void;
}) {
  const onMenu = useMessageMenu("assistant");
  const runningEmpty = useAuiState((s) => {
    if (s.message.status?.type !== "running") return false;
    return !s.message.parts?.some(
      (part) => part.type === "text" && Boolean(part.text?.trim()),
    );
  });
  if (runningEmpty) return <MessagePrimitive.Root>{null}</MessagePrimitive.Root>;
  return (
    <MessagePrimitive.Root style={styles.assistantWrap}>
      {props.kind === "room" ? (
        <Text style={styles.who}>{props.botName}</Text>
      ) : null}
      <Pressable
        onLongPress={onMenu}
        delayLongPress={350}
        accessibilityHint="Long press for Copy and Retry"
        style={styles.assistantBubble}
      >
        <MessagePrimitive.Content
          renderText={({ part }) => (
            <ChatMarkdown
              text={part.text}
              officePaths
              onOpenPath={props.onOpenPath}
            />
          )}
          renderToolCall={({ part }) =>
            part.toolName === OFFICE_ASK_TOOL_NAME ? (
              <AskCard
                toolCallId={part.toolCallId}
                args={part.args}
                result={part.result}
              />
            ) : part.toolName === PRESENT_TOOL_NAME ? (
              <PresentCard tree={part.args} botId={props.botId} />
            ) : part.toolName === OFFICE_STAMP_APP_TOOL_NAME ? (
              <View />
            ) : (
              <ToolFallback
                toolName={part.toolName}
                argsText={
                  part.argsText ||
                  (part.args ? JSON.stringify(part.args, null, 2) : "")
                }
              />
            )
          }
          renderImage={({ part }) => <PartImage image={part.image} />}
          renderFile={({ part }) => (
            <PartFile name={part.filename} mimeType={part.mimeType} />
          )}
          renderReasoning={({ part }) => <Reasoning text={part.text} />}
        />
        <OfficeAppCards botId={props.botId} />
        <ErrorPrimitive.Root style={styles.errorBox}>
          <ErrorPrimitive.Message style={styles.errorText} />
        </ErrorPrimitive.Root>
      </Pressable>
      <BranchPicker />
    </MessagePrimitive.Root>
  );
}

function Reasoning(props: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!props.text.trim()) return null;
  return (
    <Pressable onPress={() => setOpen((value) => !value)} style={styles.tool}>
      <Text style={styles.toolName}>{open ? "Hide thinking" : "Thinking"}</Text>
      {open ? <ChatMarkdown text={props.text} /> : null}
    </Pressable>
  );
}

function ToolFallback(props: { toolName?: string; argsText?: string }) {
  const [open, setOpen] = useState(false);
  const name = props.toolName || "tool";
  return (
    <Pressable onPress={() => setOpen((value) => !value)} style={styles.tool}>
      <Text style={styles.toolName}>{name}</Text>
      {open && props.argsText ? (
        <Text style={styles.toolArgs}>{props.argsText}</Text>
      ) : null}
    </Pressable>
  );
}

function PartImage(props: { image: string }) {
  if (!props.image) return null;
  return (
    <Image
      source={{ uri: props.image }}
      style={styles.partImage}
      resizeMode="cover"
      accessibilityLabel="Image"
    />
  );
}

function PartFile(props: { name?: string; mimeType?: string }) {
  return (
    <View style={styles.attachChip}>
      <Text style={styles.muted} numberOfLines={1}>
        {props.name || props.mimeType || "file"}
      </Text>
    </View>
  );
}

function OfficeAppCards(props: { botId: string }) {
  const parts = useAuiState((s) => s.message.parts);
  const cards = appCardsFromOfficeMessage({
    id: "msg",
    role: "assistant",
    parts: (parts ?? []) as never,
  });
  if (cards.length === 0) return null;
  return (
    <View style={styles.cards}>
      {cards.map((card) => (
        <AppCard
          key={card.appId}
          templateId={card.templateId}
          title={card.title}
          onOpen={() => {
            void Linking.openURL(officeAppUrl(props.botId, card.appId));
          }}
        />
      ))}
    </View>
  );
}

function BranchPicker() {
  const count = useAuiState((s) => s.message.branchCount);
  if (count <= 1) return null;
  return (
    <View style={styles.branch}>
      <BranchPickerPrimitive.Previous style={styles.barBtn}>
        <Text style={styles.barLabel}>‹</Text>
      </BranchPickerPrimitive.Previous>
      <Text style={styles.muted}>
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </Text>
      <BranchPickerPrimitive.Next style={styles.barBtn}>
        <Text style={styles.barLabel}>›</Text>
      </BranchPickerPrimitive.Next>
    </View>
  );
}

function EditComposer() {
  return (
    <MessagePrimitive.Root style={styles.userWrap}>
      <ComposerPrimitive.Root style={styles.editBox}>
        <ComposerPrimitive.Input
          multiline
          style={styles.input}
          accessibilityLabel="Edit message"
        />
        <View style={styles.actions}>
          <ComposerPrimitive.Cancel style={styles.stop}>
            <Text style={styles.stopLabel}>Cancel</Text>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send style={styles.send}>
            <Text style={styles.sendLabel}>Update</Text>
          </ComposerPrimitive.Send>
        </View>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
}

function AttachmentChip() {
  const name = useAuiState((s) => s.attachment?.name);
  const type = useAuiState((s) => s.attachment?.type);
  const file = useAuiState((s) => s.attachment?.file) as
    | { previewUri?: string }
    | undefined;
  if (type === "image" && file?.previewUri) {
    return (
      <AttachmentPrimitive.Root style={styles.thumbWrap}>
        <Image source={{ uri: file.previewUri }} style={styles.thumb} />
      </AttachmentPrimitive.Root>
    );
  }
  if (!name) return null;
  return (
    <AttachmentPrimitive.Root style={styles.attachChip}>
      <AttachmentPrimitive.Thumb style={styles.muted} />
      <Text style={styles.muted}>{name}</Text>
    </AttachmentPrimitive.Root>
  );
}

function Composer(props: {
  placeholder: string;
  pending?: boolean;
  members: readonly RoomMentionSeat[];
}) {
  const pending = Boolean(props.pending);
  return (
    <ComposerPrimitive.Root style={styles.composer}>
      {props.members.length > 0 ? (
        <RoomMentionMenu seats={props.members} />
      ) : null}
      <OfficeSkillSlash />
      <ComposerAttachments />
      <ComposerQueue />
      <View style={styles.composeRow}>
        <AttachButton />
        <ComposerPrimitive.Input
          placeholder={props.placeholder}
          placeholderTextColor={colors.faint}
          multiline
          style={styles.input}
          accessibilityLabel="Message input"
        />
        <AuiIf condition={(s) => s.thread.isRunning || pending}>
          <ComposerPrimitive.Cancel style={styles.iconHit}>
            <SymbolView
              name="stop.fill"
              tintColor={colors.text}
              size={16}
              resizeMode="scaleAspectFit"
            />
          </ComposerPrimitive.Cancel>
        </AuiIf>
        <AuiIf
          condition={(s) =>
            Boolean(s.composer.text.trim()) &&
            !s.thread.isRunning &&
            !pending
          }
        >
          <SendDisc />
        </AuiIf>
        <AuiIf
          condition={(s) =>
            !s.composer.text.trim() && !s.thread.isRunning && !pending
          }
        >
          <View style={styles.iconHit} accessibilityElementsHidden>
            <SymbolView
              name="mic"
              tintColor={colors.muted}
              size={20}
              resizeMode="scaleAspectFit"
            />
          </View>
        </AuiIf>
      </View>
    </ComposerPrimitive.Root>
  );
}

function ComposerQueue() {
  return (
    <ComposerPrimitive.Queue>
      {() => (
        <View style={styles.queueItem}>
          <QueueItemPrimitive.Text style={styles.muted} />
          <QueueItemPrimitive.Steer style={styles.barBtn}>
            <Text style={styles.barLabel}>Now</Text>
          </QueueItemPrimitive.Steer>
          <QueueItemPrimitive.Remove style={styles.remove}>
            <Text style={styles.removeLabel}>×</Text>
          </QueueItemPrimitive.Remove>
        </View>
      )}
    </ComposerPrimitive.Queue>
  );
}

function ComposerAttachments() {
  const count = useAuiState((s) => s.composer.attachments.length);
  if (count === 0) return null;
  return (
    <View style={styles.attachRow}>
      <ComposerPrimitive.Attachments>
        {() => <ComposerAttachment />}
      </ComposerPrimitive.Attachments>
    </View>
  );
}

function ComposerAttachment() {
  const name = useAuiState((s) => s.attachment?.name);
  const type = useAuiState((s) => s.attachment?.type);
  const file = useAuiState((s) => s.attachment?.file) as
    | { previewUri?: string }
    | undefined;
  return (
    <AttachmentPrimitive.Root style={styles.attachChip}>
      {type === "image" && file?.previewUri ? (
        <Image source={{ uri: file.previewUri }} style={styles.thumb} />
      ) : (
        <AttachmentPrimitive.Thumb style={styles.muted} />
      )}
      <Text style={styles.muted} numberOfLines={1}>
        {name}
      </Text>
      <AttachmentPrimitive.Remove style={styles.remove}>
        <Text style={styles.removeLabel}>×</Text>
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
}

function SendDisc() {
  const press = usePressScale(0.86);
  return (
    <Animated.View style={press.style}>
      <ComposerPrimitive.Send
        style={styles.send}
        onPressIn={() => {
          press.onPressIn();
          tapMedium();
        }}
        onPressOut={press.onPressOut}
      >
        <SymbolView
          name="arrow.up"
          tintColor={colors.accentInk}
          size={16}
          resizeMode="scaleAspectFit"
        />
      </ComposerPrimitive.Send>
    </Animated.View>
  );
}

function AttachButton() {
  const aui = useAui();
  const pending = useAuiState((s) => s.composer.attachments.length);

  async function addFiles(
    picker: (
      count: number,
    ) => Promise<Awaited<ReturnType<typeof pickOfficeFiles>>>,
  ) {
    try {
      const files = await picker(pending);
      for (const file of files) {
        await aui.composer.addAttachment(file as unknown as File);
      }
    } catch (caught) {
      Alert.alert(
        "Could not attach",
        caught instanceof Error ? caught.message : "Try another file.",
      );
    }
  }

  const press = usePressScale(0.88);
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Attach"
        onPress={() => {
          showActionSheet(undefined, [
            {
              label: "Photo",
              onPress: () => void addFiles(pickOfficePhotos),
            },
            {
              label: "File",
              onPress: () => void addFiles(pickOfficeFiles),
            },
            { label: "Cancel", cancel: true },
          ]);
        }}
        onPressIn={() => {
          press.onPressIn();
          tapSoft();
        }}
        onPressOut={press.onPressOut}
        style={styles.iconHit}
      >
        <SymbolView
          name="plus"
          tintColor={colors.text}
          size={20}
          resizeMode="scaleAspectFit"
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  messages: { paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
  workingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  workingCopy: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  starters: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  starter: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  starterLabel: { color: colors.text, fontSize: 14, fontWeight: "500" },
  userWrap: { alignItems: "flex-end", gap: 4 },
  assistantWrap: { alignItems: "flex-start", gap: 6 },
  who: { color: colors.faint, fontSize: 11, fontWeight: "600" },
  userBubble: {
    maxWidth: "85%",
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  assistantBubble: {
    maxWidth: "92%",
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cards: { gap: 8, marginTop: 4 },
  tool: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 8,
    marginVertical: 4,
  },
  toolName: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  toolArgs: { color: colors.faint, fontSize: 12, marginTop: 4 },
  errorBox: {
    marginTop: 8,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
    padding: 8,
  },
  errorText: { color: colors.danger, fontSize: 13 },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 8,
    backgroundColor: colors.bg,
  },
  composeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    minHeight: 52,
    paddingLeft: 4,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  editBox: {
    width: "85%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 10,
    backgroundColor: colors.surface,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  attachBtns: { flexDirection: "row", gap: 6 },
  iconHit: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  attachRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  attachChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  thumbWrap: { borderRadius: 10, overflow: "hidden" },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  partImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    backgroundColor: colors.surface2,
  },
  iconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
  },
  iconLabel: { color: colors.text, fontSize: 13, fontWeight: "600" },
  send: {
    width: 34,
    height: 34,
    marginBottom: 5,
    backgroundColor: colors.accent,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  sendLabel: { color: colors.bg, fontWeight: "500" },
  stop: {
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  stopLabel: { color: colors.text, fontWeight: "500" },
  remove: { paddingHorizontal: 4 },
  removeLabel: { color: colors.muted, fontSize: 16 },
  banner: { color: colors.danger, paddingHorizontal: 16, paddingBottom: 8 },
  archived: {
    margin: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: 8,
  },
  archivedCopy: { color: colors.text },
  link: { color: colors.accent, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 13 },
  barBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  barLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  branch: { flexDirection: "row", alignItems: "center", gap: 4 },
  followups: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 8 },
  followup: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  followupLabel: { color: colors.text, fontSize: 13 },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  approvals: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  approval: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 10,
    backgroundColor: colors.card,
    gap: 8,
  },
  approvalCopy: { color: colors.text, fontWeight: "600" },
  approvalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
});
