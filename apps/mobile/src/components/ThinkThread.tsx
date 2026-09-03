import { useAISDKRuntime } from "@assistant-ui/ai-sdk";
import {
  AssistantRuntimeProvider,
  AttachmentPrimitive,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
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
import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { OfficeSkillSlash } from "./OfficeSkillSlash";

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
          <AuiIf condition={(s) => s.thread.isRunning}>
            <View style={styles.workingRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.muted}>{props.botName} is working…</Text>
            </View>
          </AuiIf>
        }
      >
        {() => (
          <ThreadMessage
            botId={props.botId}
            viewerUserId={props.viewerUserId}
          />
        )}
      </ThreadPrimitive.MessagesFlatList>
      {props.hideComposer ? null : <Composer placeholder={props.placeholder} />}
    </ThreadPrimitive.Root>
  );
}

function ThreadMessage(props: { botId: string; viewerUserId?: string }) {
  const role = useAuiState((s) => s.message.role);
  const metadata = useAuiState((s) => s.message.metadata);
  const sender = officeUserMessageSender(metadata, props.viewerUserId);
  if (role === "user") {
    return (
      <MessagePrimitive.Root style={styles.userWrap}>
        {sender ? <Text style={styles.who}>{sender.label}</Text> : null}
        <View style={styles.userBubble}>
          <MessagePrimitive.Parts components={{ Text: UserText }} />
        </View>
        <MessagePrimitive.Attachments>
          {() => <AttachmentChip />}
        </MessagePrimitive.Attachments>
      </MessagePrimitive.Root>
    );
  }
  return (
    <MessagePrimitive.Root style={styles.assistantWrap}>
      <MessagePrimitive.Parts
        components={{
          Text: AssistantText,
          tools: { Fallback: ToolFallback },
        }}
      />
      <ThinkAppCards botId={props.botId} />
      <ErrorPrimitive.Root style={styles.errorBox}>
        <ErrorPrimitive.Message style={styles.errorText} />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Root>
  );
}

const UserText: TextMessagePartComponent = ({ text }) => (
  <Text style={styles.userText}>{text}</Text>
);

const AssistantText: TextMessagePartComponent = ({ text }) => (
  <Text style={styles.assistantText}>{text}</Text>
);

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

function AttachmentChip() {
  const name = useAuiState((s) => s.attachment?.name);
  if (!name) return null;
  return (
    <AttachmentPrimitive.Root style={styles.attachChip}>
      <Text style={styles.muted}>{name}</Text>
    </AttachmentPrimitive.Root>
  );
}

function Composer(props: { placeholder: string }) {
  return (
    <ComposerPrimitive.Root style={styles.composer}>
      <OfficeSkillSlash />
      <ComposerAttachments />
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
  return (
    <AttachmentPrimitive.Root style={styles.attachChip}>
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
  who: { color: colors.faint, fontSize: 11 },
  userBubble: {
    maxWidth: "85%",
    backgroundColor: colors.surface2,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  userText: { color: colors.text, fontSize: 16, lineHeight: 22 },
  assistantText: { color: colors.text, fontSize: 16, lineHeight: 24 },
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
});
