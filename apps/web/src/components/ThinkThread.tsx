import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import type { UIMessage } from "ai";
import {
  type FormEvent,
  type MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  StickToBottom,
  type StickToBottomContext,
} from "use-stick-to-bottom";
import {
  coalesceAssistantMessages,
  isVisibleChatMessage,
  lastThinkPreview,
  splitQueuedFollowUps,
  textFromMessage,
  usedTools,
} from "../lib/chat-messages";
import { patchBot } from "../lib/collections";
import { agentSocketHost } from "../lib/host";
import { FIRST_TASK } from "../lib/jobs";
import {
  fetchThinkMessages,
  peekThinkMessages,
  setThinkMessages,
  thinkAgentHttpUrl,
} from "../lib/think-messages";
import { Button, cn } from "../ui";
import { ChatMarkdown } from "./ChatMarkdown";
import { MicIcon, PlusIcon } from "./Icons";
import { TypingDots } from "./TypingDots";

function rememberPreview(botId: string, messages: UIMessage[]) {
  setThinkMessages(botId, messages);
  const preview = lastThinkPreview(messages);
  if (!preview) return;
  patchBot(botId, { lastPreview: preview });
}

export function ThinkThread(props: {
  botId: string;
  botName: string;
  draft: string;
  setDraft: (text: string) => void;
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
    onConnectionError: (err) => {
      onErrorRef.current(err.message || "Could not reach this teammate");
    },
  });

  const { messages, sendMessage, setMessages, status, stop, error } =
    useAgentChat({
      agent,
      credentials: "include",
      syncMessagesToServer: false,
      getInitialMessages: null,
      messages: seed,
    });
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const visible = useMemo(
    () => coalesceAssistantMessages(messages).filter(isVisibleChatMessage),
    [messages],
  );
  const busy = status === "submitted" || status === "streaming";
  const { thread, queued } = useMemo(
    () => splitQueuedFollowUps(visible, busy),
    [visible, busy],
  );
  const stick = useRef<StickToBottomContext>(null);
  const sending = useRef(false);
  const wasBusy = useRef(false);
  const last = thread.at(-1);
  const liveId = busy && last?.role === "assistant" ? last.id : undefined;

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

  const agentError = error?.message || "";
  useEffect(() => {
    if (!agentError || agentError === props.error) return;
    onErrorRef.current(agentError);
  }, [agentError, props.error]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (props.archived) return;
    if (props.needsModel) {
      props.onNeedsModel();
      props.onError(
        "Add a model key, or use Groxbot’s included gateway, to talk to teammates.",
      );
      return;
    }
    const text = props.draft.trim();
    if (!text || sending.current) return;
    dirty.current = true;
    sending.current = true;
    void stick.current?.scrollToBottom("instant");
    props.setDraft("");
    patchBot(props.botId, { lastPreview: text.slice(0, 140) });
    try {
      const pending = sendMessage({ text });
      sending.current = false;
      await pending;
    } catch (caught) {
      sending.current = false;
      props.setDraft(text);
      props.onError(
        caught instanceof Error ? caught.message : "Could not send",
      );
    }
  }

  const empty = thread.length === 0 && queued.length === 0 && !busy;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StickToBottom
        className="think-stick relative min-h-0 flex-1 overflow-hidden"
        resize="smooth"
        initial="instant"
        contextRef={stick}
      >
        <StickToBottom.Content className="flex flex-col gap-2.5 px-7 pt-2.5 pb-6">
          {waiting && empty ? (
            <TypingDots label={`Loading ${props.botName}`} />
          ) : empty ? (
            <p className="mb-6 text-base leading-normal text-muted">
              First message is a real task. A good handoff has an outcome,
              sources, and when to stop.
            </p>
          ) : null}
          {thread.map((message) => {
            const text = textFromMessage(message);
            const human = message.role === "user";
            const tools = usedTools(message);
            if (!text && !tools) return null;
            return (
              <div
                key={message.id}
                className={cn(
                  "max-w-[72%] rounded-[18px] px-3.5 py-2.5 text-[15px] leading-snug",
                  human
                    ? "ml-auto border border-[#2a2a2a] bg-[#1a1a1a] light:border-line light:bg-white"
                    : "mr-auto bg-[#141414] light:bg-[#ececec]",
                )}
              >
                {tools && !human && !text ? (
                  <div className="mb-1 text-[11px] font-medium tracking-wide text-muted uppercase">
                    Using the workspace
                  </div>
                ) : null}
                <ChatMarkdown text={text} live={message.id === liveId} />
              </div>
            );
          })}
          {busy && thread.at(-1)?.role !== "assistant" ? (
            <TypingDots label={`${props.botName} is working`} />
          ) : null}
          {queued.map((message) => (
            <div
              key={message.id}
              className="ml-auto max-w-[72%] rounded-[18px] border border-[#2a2a2a] bg-[#1a1a1a] px-3.5 py-2.5 text-[15px] leading-snug opacity-70 light:border-line light:bg-white"
            >
              <div className="mb-1 text-[11px] font-medium tracking-wide text-muted uppercase">
                Queued
              </div>
              <ChatMarkdown text={textFromMessage(message)} />
            </div>
          ))}
        </StickToBottom.Content>
      </StickToBottom>
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
        ) : (
          <form
            className="flex items-end gap-0.5 rounded-pill border border-[#262626] bg-[#141414] p-1 light:border-line light:bg-white"
            onSubmit={(event) => void send(event)}
          >
            <Button
              variant="icon"
              className="size-9 shrink-0 rounded-pill text-muted"
              type="button"
              aria-label="Attach"
              title="Attach"
            >
              <PlusIcon />
            </Button>
            <textarea
              rows={1}
              className="box-border min-h-9 max-h-[140px] flex-1 resize-none border-0 bg-transparent px-1.5 py-2 !text-[15px] !leading-5 outline-none placeholder:text-muted"
              value={props.draft}
              placeholder={props.placeholder || FIRST_TASK}
              onChange={(e) => props.setDraft(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button
              variant="icon"
              className="size-9 shrink-0 rounded-pill text-muted"
              type="button"
              aria-label="Voice"
              title="Voice"
            >
              <MicIcon />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
