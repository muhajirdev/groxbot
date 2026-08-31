import type { TemplateId, ThreadMessage } from "@groxbot/contracts";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { dayKey, formatDaySep } from "../lib/time";
import { cn } from "../ui";
import { AppCard } from "./AppCard";
import { ChatMarkdown } from "./ChatMarkdown";

export type ThreadAppCard = {
  appId: string;
  templateId: TemplateId;
  title: string;
};

type ThreadContext = {
  botId: string;
  names: Record<string, string>;
  messages: ThreadMessage[];
  empty: boolean;
  onOpenApp?: (app: ThreadAppCard) => void;
  onOpenPokeThread?: (threadId: string, peerName: string) => void;
};

function pokeThreadRef(message: ThreadMessage): {
  threadId: string;
  peerName: string;
} | null {
  const block = message.blocks.find((item) => item.kind === "poke_thread");
  if (block?.kind !== "poke_thread") return null;
  return { threadId: block.threadId, peerName: block.peerName };
}

function appRef(message: ThreadMessage): ThreadAppCard | null {
  const block = message.blocks.find((item) => item.kind === "app");
  if (block?.kind !== "app") return null;
  return {
    appId: block.appId,
    templateId: block.templateId,
    title: block.title,
  };
}

function messageText(message: ThreadMessage): string {
  return message.blocks
    .filter((block) => block.kind === "text")
    .map((block) => block.text)
    .join("\n");
}

function Header() {
  return <div className="h-2" aria-hidden />;
}

function Footer({ context }: { context: ThreadContext }) {
  return (
    <div className="flex flex-col gap-2.5 px-7 pt-2.5 pb-6">
      {context.empty ? (
        <p className="mb-6 text-base leading-normal text-muted">
          First message is a real task. A good handoff has an outcome, sources,
          and when to stop.
        </p>
      ) : null}
    </div>
  );
}

const components = { Header, Footer };

function itemContent(
  index: number,
  message: ThreadMessage,
  context: ThreadContext,
) {
  const prev = context.messages[index - 1];
  const showDay = !prev || dayKey(prev.createdAt) !== dayKey(message.createdAt);
  const text = messageText(message);
  const human = message.actorType === "human";
  const fromOther =
    message.actorType === "bot" &&
    Boolean(message.actorId) &&
    message.actorId !== context.botId;
  const fromName = fromOther
    ? context.names[message.actorId ?? ""] || "Teammate"
    : null;
  const pokeRef = pokeThreadRef(message);
  const opened = appRef(message);
  if (!text && !pokeRef && !opened && !showDay) return <div className="h-0" />;
  return (
    <div className="px-7 pb-2.5">
      {showDay ? (
        <div className="my-2.5 mb-1 text-center text-xs text-muted">
          {formatDaySep(message.createdAt)}
        </div>
      ) : null}
      {text || pokeRef ? (
        <div
          className={cn(
            "max-w-[72%] rounded-[18px] px-3.5 py-2.5 text-[15px] leading-snug",
            human
              ? "ml-auto border border-[#2a2a2a] bg-[#1a1a1a] light:border-line light:bg-white"
              : fromOther
                ? "mr-auto border border-line bg-transparent text-[13px] text-muted"
                : "mr-auto bg-[#141414] light:bg-[#ececec]",
          )}
        >
          {fromName ? (
            <div className="mb-1 text-[11px] font-medium tracking-wide text-muted uppercase">
              From {fromName}
            </div>
          ) : null}
          <ChatMarkdown text={text} />
          {pokeRef && context.onOpenPokeThread ? (
            <button
              type="button"
              className="mt-2 block border-0 bg-transparent p-0 text-[13px] font-medium text-inherit underline underline-offset-2"
              onClick={() =>
                context.onOpenPokeThread?.(pokeRef.threadId, pokeRef.peerName)
              }
            >
              Open thread
            </button>
          ) : null}
        </div>
      ) : null}
      {opened && context.onOpenApp ? (
        <div className={text || pokeRef ? "mt-2" : undefined}>
          <AppCard
            templateId={opened.templateId}
            title={opened.title}
            onOpen={() => context.onOpenApp?.(opened)}
          />
        </div>
      ) : null}
    </div>
  );
}

function itemKey(_index: number, message: ThreadMessage) {
  return message.id;
}

function followOutput(atBottom: boolean) {
  return atBottom ? "auto" : false;
}

export function ThreadList(props: {
  botId: string;
  teammateNames?: Record<string, string>;
  messages: ThreadMessage[];
  empty: boolean;
  working: string;
  onOpenApp?: (app: ThreadAppCard) => void;
  onOpenPokeThread?: (threadId: string, peerName: string) => void;
}) {
  const listRef = useRef<VirtuosoHandle>(null);
  const atBottomRef = useRef(true);
  const visible = useMemo(
    () =>
      props.messages.filter(
        (message) =>
          messageText(message).length > 0 ||
          Boolean(pokeThreadRef(message)) ||
          Boolean(appRef(message)),
      ),
    [props.messages],
  );
  const context = useMemo<ThreadContext>(
    () => ({
      botId: props.botId,
      names: props.teammateNames ?? {},
      messages: visible,
      empty: props.empty,
      onOpenApp: props.onOpenApp,
      onOpenPokeThread: props.onOpenPokeThread,
    }),
    [
      props.botId,
      props.teammateNames,
      visible,
      props.empty,
      props.onOpenApp,
      props.onOpenPokeThread,
    ],
  );

  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useLayoutEffect(() => {
    if (!props.botId) return;
    atBottomRef.current = true;
    const last = visibleRef.current.length - 1;
    if (last < 0) return;
    listRef.current?.scrollToIndex({
      index: last,
      align: "end",
      behavior: "auto",
    });
  }, [props.botId]);

  useLayoutEffect(() => {
    if (!atBottomRef.current) return;
    void props.working;
    listRef.current?.autoscrollToBottom();
  }, [props.working]);

  return (
    <Virtuoso
      ref={listRef}
      className="h-full"
      data={visible}
      context={context}
      alignToBottom
      followOutput={followOutput}
      atBottomThreshold={80}
      atBottomStateChange={(atBottom) => {
        atBottomRef.current = atBottom;
      }}
      increaseViewportBy={240}
      defaultItemHeight={56}
      initialTopMostItemIndex={
        visible.length > 0 ? { index: visible.length - 1, align: "end" } : 0
      }
      computeItemKey={itemKey}
      itemContent={itemContent}
      components={components}
    />
  );
}
