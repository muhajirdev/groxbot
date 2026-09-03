import { useAISDKRuntime } from "@assistant-ui/ai-sdk";
import {
  ActionBarPrimitive,
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
import { useAgentChat } from "@cloudflare/ai-chat/react";
import {
  officeUserFromActor,
  withOfficeUserMetadata,
} from "@groxbot/contracts";
import { useAgent } from "agents/react";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { appCardsFromThinkMessage } from "../lib/app-cards";
import { createWorkspaceAttachmentAdapter } from "../lib/attachment-adapter";
import { sessionCookie } from "../lib/auth";
import { lastUiPreview } from "../lib/chat-messages";
import { composerBannerError } from "../lib/errors";
import { agentSocketHost, officeAppUrl } from "../lib/host";
import { FIRST_TASK } from "../lib/jobs";
import { officeUserMessageSender } from "../lib/office-sender";
import { orpc, queryClient } from "../lib/orpc";
import { pickOfficeFiles, pickOfficePhotos } from "../lib/pick-file";
import { client } from "../lib/rpc";
import { colors, radius } from "../theme";
import { useSetWorking } from "../working";
import { AppCard } from "./AppCard";
import { ChatMarkdown } from "./ChatMarkdown";
import { OfficeSkillSlash } from "./OfficeSkillSlash";

async function copyToClipboard(text: string) {
  const didCopy = await Clipboard.setStringAsync(text);
  if (!didCopy) throw new Error("Clipboard write failed");
}

export function ThinkThread(props: {
  botId: string;
  botName: string;
  archived: boolean;
  needsModel: boolean;
  placeholder?: string;
  userId?: string;
  userName?: string;
  onNeedsModel: () => void;
  onUnarchive: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <View style={styles.fill}>
      <ThinkThreadRuntime
        botId={props.botId}
        botName={props.botName}
        archived={props.archived}
        needsModel={props.needsModel}
        placeholder={props.placeholder || FIRST_TASK}
        userId={props.userId}
        userName={props.userName}
        error={error}
        onError={setError}
        onNeedsModel={props.onNeedsModel}
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

function ThinkThreadRuntime(props: {
  botId: string;
  botName: string;
  archived: boolean;
  needsModel: boolean;
  placeholder: string;
  userId?: string;
  userName?: string;
  error: string;
  onError: (error: string) => void;
  onNeedsModel: () => void;
}) {
  const socket = agentSocketHost();
  const [cookie, setCookie] = useState("");
  useEffect(() => {
    void sessionCookie().then(setCookie);
  }, []);
  const headers: Record<string, string> = cookie ? { Cookie: cookie } : {};
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

  const agent = useAgent({
    agent: "BotActor",
    name: props.botId,
    host: socket.host,
    query: cookie ? { Cookie: cookie } : undefined,
    queryDeps: [cookie],
  });

  const chat = useAgentChat({
    agent,
    credentials: "omit",
    headers,
    syncMessagesToServer: false,
    getInitialMessages: null,
  });
  const { status, stop, error, sendMessage, isStreaming, connectionError } =
    chat;
  const busy = status === "submitted" || status === "streaming" || isStreaming;
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
    setWorking(props.botId, busy);
    return () => setWorking(props.botId, false);
  }, [busy, props.botId, setWorking]);

  useEffect(() => {
    const preview = lastUiPreview(chat.messages);
    if (!preview) return;
    queryClient.setQueryData(orpc.bots.list.queryOptions().queryKey, (rows) => {
      if (!rows) return rows;
      return rows.map((row) =>
        row.id === props.botId ? { ...row, lastPreview: preview } : row,
      );
    });
  }, [chat.messages, props.botId]);

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

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <OfficeThread
        botId={props.botId}
        botName={props.botName}
        hideComposer={props.archived}
        placeholder={props.placeholder}
        viewerUserId={props.userId}
      />
    </AssistantRuntimeProvider>
  );
}

function OfficeThread(props: {
  botId: string;
  botName: string;
  hideComposer: boolean;
  placeholder: string;
  viewerUserId?: string;
}) {
  return (
    <ThreadPrimitive.Root style={styles.fill}>
      <ThreadPrimitive.MessagesFlatList
        autoScroll
        contentContainerStyle={styles.messages}
        ListHeaderComponent={
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <Text style={styles.welcome}>
              First message is a real task. A good handoff has an outcome,
              sources, and when to stop.
            </Text>
          </AuiIf>
        }
        ListFooterComponent={
          <>
            <AuiIf
              condition={(s) =>
                s.thread.isRunning &&
                (s.thread.messages.at(-1)?.role !== "assistant" ||
                  !s.thread.messages.length)
              }
            >
              <View style={styles.workingRow}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>{props.botName} is working…</Text>
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
            viewerUserId={props.viewerUserId}
          />
        )}
      </ThreadPrimitive.MessagesFlatList>
      {props.hideComposer ? null : <Composer placeholder={props.placeholder} />}
    </ThreadPrimitive.Root>
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

function ThreadMessage(props: {
  botId: string;
  botName: string;
  viewerUserId?: string;
}) {
  const role = useAuiState((s) => s.message.role);
  const editing = useAuiState((s) => s.message.composer.isEditing);
  if (editing) return <EditComposer />;
  if (role === "user") {
    return <UserMessage viewerUserId={props.viewerUserId} />;
  }
  return <AssistantMessage botId={props.botId} botName={props.botName} />;
}

function UserMessage(props: { viewerUserId?: string }) {
  const metadata = useAuiState((s) => s.message.metadata);
  const sender = officeUserMessageSender(metadata, props.viewerUserId);
  return (
    <MessagePrimitive.Root style={styles.userWrap}>
      {sender ? <Text style={styles.who}>{sender.label}</Text> : null}
      <View style={styles.userBubble}>
        <MessagePrimitive.Parts components={{ Text: UserText }} />
      </View>
      <MessagePrimitive.Attachments>
        {() => <AttachmentChip />}
      </MessagePrimitive.Attachments>
      <View style={styles.userBar}>
        <BranchPicker />
        <ActionBarPrimitive.Edit style={styles.barBtn}>
          <Text style={styles.barLabel}>Edit</Text>
        </ActionBarPrimitive.Edit>
      </View>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage(props: { botId: string; botName: string }) {
  const runningEmpty = useAuiState((s) => {
    if (s.message.status?.type !== "running") return false;
    return !s.message.parts?.some(
      (part) => part.type === "text" && Boolean(part.text?.trim()),
    );
  });
  return (
    <MessagePrimitive.Root style={styles.assistantWrap}>
      <Text style={styles.who}>{props.botName}</Text>
      {runningEmpty ? (
        <View style={styles.workingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>{props.botName} is working…</Text>
        </View>
      ) : null}
      <MessagePrimitive.Content
        renderText={({ part }) => <ChatMarkdown text={part.text} />}
        renderToolCall={({ part }) => (
          <ToolFallback
            toolName={part.toolName}
            argsText={
              part.argsText ||
              (part.args ? JSON.stringify(part.args, null, 2) : "")
            }
          />
        )}
        renderImage={({ part }) => <PartImage image={part.image} />}
        renderFile={({ part }) => (
          <PartFile name={part.filename} mimeType={part.mimeType} />
        )}
        renderReasoning={({ part }) => <Reasoning text={part.text} />}
      />
      <ThinkAppCards botId={props.botId} />
      <ErrorPrimitive.Root style={styles.errorBox}>
        <ErrorPrimitive.Message style={styles.errorText} />
      </ErrorPrimitive.Root>
      <View style={styles.assistantBar}>
        <BranchPicker />
        <ActionBarPrimitive.Copy copyToClipboard={copyToClipboard}>
          {({ isCopied }) => (
            <Text style={styles.barLabel}>{isCopied ? "Copied" : "Copy"}</Text>
          )}
        </ActionBarPrimitive.Copy>
        <ActionBarPrimitive.Reload style={styles.barBtn}>
          <Text style={styles.barLabel}>Retry</Text>
        </ActionBarPrimitive.Reload>
      </View>
    </MessagePrimitive.Root>
  );
}

const UserText: TextMessagePartComponent = ({ text }) => (
  <ChatMarkdown text={text} />
);

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

function ThinkAppCards(props: { botId: string }) {
  const parts = useAuiState((s) => s.message.parts);
  const cards = appCardsFromThinkMessage({
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

function Composer(props: { placeholder: string }) {
  return (
    <ComposerPrimitive.Root style={styles.composer}>
      <OfficeSkillSlash />
      <ComposerAttachments />
      <ComposerQueue />
      <ComposerPrimitive.Input
        placeholder={props.placeholder}
        placeholderTextColor={colors.faint}
        multiline
        style={styles.input}
        accessibilityLabel="Message input"
      />
      <View style={styles.actions}>
        <View style={styles.actionLeft}>
          <AttachButton />
        </View>
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send style={styles.send}>
            <Text style={styles.sendLabel}>Send</Text>
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel style={styles.stop}>
            <Text style={styles.stopLabel}>Stop</Text>
          </ComposerPrimitive.Cancel>
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

  return (
    <View style={styles.attachBtns}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Attach a file"
        onPress={() => void addFiles(pickOfficeFiles)}
        style={styles.iconBtn}
      >
        <Text style={styles.iconLabel}>File</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Attach a photo"
        onPress={() => void addFiles(pickOfficePhotos)}
        style={styles.iconBtn}
      >
        <Text style={styles.iconLabel}>Photo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  messages: { paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
  welcome: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  workingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  userWrap: { alignItems: "flex-end", gap: 4 },
  assistantWrap: { alignItems: "flex-start", gap: 6 },
  who: { color: colors.faint, fontSize: 11, fontWeight: "600" },
  userBubble: {
    maxWidth: "85%",
    backgroundColor: colors.surface2,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cards: { gap: 8, marginTop: 4 },
  tool: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 8,
    marginVertical: 4,
  },
  toolName: { color: colors.muted, fontSize: 12, fontWeight: "700" },
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    padding: 12,
    gap: 8,
    backgroundColor: colors.bg,
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
    minHeight: 40,
    maxHeight: 120,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  attachBtns: { flexDirection: "row", gap: 6 },
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
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendLabel: { color: colors.accentInk, fontWeight: "700" },
  stop: {
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  stopLabel: { color: colors.text, fontWeight: "700" },
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
  link: { color: colors.accent, fontWeight: "700" },
  muted: { color: colors.muted, fontSize: 13 },
  assistantBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  userBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  barBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  barLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
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
});
