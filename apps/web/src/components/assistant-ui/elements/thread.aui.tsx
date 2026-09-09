"use client";

import {
  ComposerAddAttachment,
  ComposerAttachments,
} from "@/components/assistant-ui/elements/attachment.aui";
import { File } from "@/components/assistant-ui/elements/file";
import { ThreadFollowupSuggestions } from "@/components/assistant-ui/elements/follow-up-suggestions.aui";
import { Image } from "@/components/assistant-ui/elements/image";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback.aui";
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from "@/components/assistant-ui/elements/tool-group.aui";
import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { ThinkingStatus } from "@/components/assistant-ui/elements/spiral-loader";
import {
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/components/assistant-ui/elements/reasoning.aui";
import { PersonAvatar } from "@/components/PersonAvatar";
import { AvatarMark } from "@/components/Avatar";
import { OfficeSkillSlash } from "@/components/OfficeSkillSlash";
import { RoomMentionMenu } from "@/components/RoomMentionMenu";
import type { RoomMentionSeat } from "@/lib/room-mention";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { officeUserMessageSender } from "@/lib/office-sender";
import { parseRoomSpeaker } from "@groxbot/core/browser";
import { isOfficeLearnedMessage } from "@groxbot/contracts";
import { isVisibleChatMessage } from "@/lib/chat-messages";
import {
  assistantTurnHasRunningTool,
  isWaitingForAssistantTurn,
} from "@/lib/thread-waiting";
import { messageDaySep } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  ThreadPrimitive,
  type ToolCallMessagePartComponent,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MicIcon,
  SquareIcon,
  UploadIcon,
} from "@/components/Icons";
import {
  createContext,
  useContext,
  type ComponentType,
  type FC,
  type PropsWithChildren,
} from "react";

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

/**
 * Optional component overrides for the thread. `AssistantMessage` and
 * `Welcome` replace whole sections; the remaining slots override how the
 * assistant message renders tool calls and part groups. Tool UIs registered
 * by name (toolkit `render`, `useAssistantDataUI`) take precedence over
 * `ToolFallback`.
 */
export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  ToolGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
  ReasoningGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
};

export type ThreadProps = {
  components?: ThreadComponents | undefined;
  autoFocus?: boolean | undefined;
  placeholder?: string | undefined;
  hideComposer?: boolean | undefined;
  viewerUserId?: string | undefined;
  viewerImage?: string | undefined;
  botName?: string | undefined;
  /** Seated bots for `@` in a shared room. Empty in 1:1. */
  mentionSeats?: readonly RoomMentionSeat[] | undefined;
  /** Composer sent; chat status has not reached submitted yet. */
  pending?: boolean | undefined;
};

const EMPTY_COMPONENTS: ThreadComponents = {};

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS);

const ThreadChromeContext = createContext({
  hideComposer: false,
  placeholder: "Send a message...",
  viewerUserId: "",
  viewerImage: "",
  botName: "",
  mentionSeats: [] as readonly RoomMentionSeat[],
  pending: false,
});

// Empty office thread: still a chat — composer stays docked at the bottom.
const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  (!s.thread.isLoading || s.threads.isLoading);

// A switched thread that is still fetching its history: skeleton, not welcome.
const isHistoryLoadingView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  s.thread.isLoading &&
  !s.thread.isDisabled &&
  !s.threads.isLoading;

const lastThreadMessage = (s: AssistantState) =>
  s.thread.messages[s.thread.messages.length - 1];

const isWaitingForAssistantMessage =
  (pending: boolean) => (s: AssistantState) =>
    isWaitingForAssistantTurn({
      isRunning: s.thread.isRunning,
      pending,
      lastMessage: lastThreadMessage(s),
    });

const ThreadHistorySkeleton: FC = () => (
  <div
    data-slot="aui_thread-history-skeleton"
    role="status"
    className="animate-in fade-in fill-mode-both flex flex-col gap-y-3 [animation-delay:150ms] [animation-duration:200ms]"
  >
    <span className="sr-only">Loading conversation</span>
    <Skeleton className="ml-auto h-9 w-2/5 rounded-xl motion-reduce:animate-none" />
    <div className="flex flex-col gap-y-2">
      <Skeleton className="h-4 w-11/12 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-3/5 motion-reduce:animate-none" />
    </div>
    <Skeleton className="ml-auto h-9 w-1/3 rounded-xl motion-reduce:animate-none" />
    <div className="flex flex-col gap-y-2">
      <Skeleton className="h-4 w-10/12 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
    </div>
  </div>
);

export const Thread: FC<ThreadProps> = ({
  components = EMPTY_COMPONENTS,
  autoFocus = true,
  placeholder = "Send a message...",
  hideComposer = false,
  viewerUserId = "",
  viewerImage = "",
  botName = "",
  mentionSeats = [],
  pending = false,
}) => {
  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadChromeContext.Provider
        value={{
          hideComposer,
          placeholder,
          viewerUserId,
          viewerImage,
          botName,
          mentionSeats,
          pending,
        }}
      >
        <ThreadRoot autoFocus={autoFocus} />
      </ThreadChromeContext.Provider>
    </ThreadComponentsContext.Provider>
  );
};

const ThreadRoot: FC<{ autoFocus: boolean }> = ({ autoFocus }) => {
  const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext);
  const { hideComposer, pending } = useContext(ThreadChromeContext);
  const waiting = isWaitingForAssistantMessage(pending);

  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root bg-bg-thread @container flex h-full flex-col"
      style={{
        ["--thread-max-width" as string]: "100%",
        ["--composer-bg" as string]: "var(--color-card)",
        ["--composer-radius" as string]: "1rem",
        ["--composer-padding" as string]: "8px",
      }}
    >
      <ComposerPrimitive.AttachmentDropzone
        disabled={hideComposer}
        className="aui-thread-dropzone group/drop relative flex min-h-0 flex-1 flex-col"
      >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto scroll-smooth"
      >
        <div className="mx-auto flex min-h-full w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-2.5 min-[721px]:px-5 min-[721px]:pt-3">
          <AuiIf condition={isHistoryLoadingView}>
            <ThreadHistorySkeleton />
          </AuiIf>

          <div
            data-slot="aui_message-group"
            className="mb-8 flex flex-col gap-y-3 empty:hidden"
          >
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>
            <AuiIf condition={waiting}>
              <div className="px-2" data-slot="aui_assistant-waiting">
                <AssistantWorkingStatus />
              </div>
            </AuiIf>
          </div>

          <ThreadPrimitive.ViewportFooter
            className="aui-thread-viewport-footer bg-bg-thread sticky bottom-0 mt-auto flex flex-col gap-2 overflow-visible rounded-t-(--composer-radius) pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-3"
          >
            <ThreadScrollToBottom />
            <ThreadFollowupSuggestions />
            <AuiIf condition={(s) => isNewChatView(s) && !pending}>
              <Welcome />
            </AuiIf>
            {hideComposer ? null : <Composer autoFocus={autoFocus} />}
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
      <ThreadDropHint />
      </ComposerPrimitive.AttachmentDropzone>
    </ThreadPrimitive.Root>
  );
};

const ThreadDropHint: FC = () => {
  return (
    <div
      aria-hidden
      className="pointer-events-none invisible absolute inset-0 z-20 grid place-items-center bg-bg-thread/80 opacity-0 backdrop-blur-[2px] transition-[opacity,visibility] duration-150 group-data-[dragging=true]/drop:visible group-data-[dragging=true]/drop:opacity-100"
    >
      <div className="flex scale-95 flex-col items-center gap-2.5 transition-transform duration-150 group-data-[dragging=true]/drop:scale-100">
        <div className="grid size-12 place-items-center rounded-full bg-accent/15 text-accent">
          <UploadIcon size={22} />
        </div>
        <p className="text-[14px] font-medium text-ink">Drop files here</p>
      </div>
    </div>
  );
};

const ThreadMessage: FC = () => {
  const { AssistantMessage: AssistantMessageComponent = AssistantMessage } =
    useContext(ThreadComponentsContext);
  const hidden = useAuiState((s) => !isVisibleChatMessage(s.message));
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);

  if (hidden) return null;
  return (
    <>
      <MessageDaySep />
      {isEditing ? (
        <EditComposer />
      ) : role === "user" ? (
        <UserMessage />
      ) : (
        <AssistantMessageComponent />
      )}
    </>
  );
};

const MessageDaySep: FC = () => {
  const label = useAuiState((s) => {
    const createdAt = s.message.createdAt;
    const id = s.message.id;
    const messages = s.thread.messages;
    const index = messages.findIndex((row) => row.id === id);
    let previous: Date | undefined;
    for (let i = index - 1; i >= 0; i--) {
      const row = messages[i];
      if (!row || !isVisibleChatMessage(row)) continue;
      previous = row.createdAt;
      break;
    }
    return messageDaySep(createdAt, previous);
  });
  if (!label) return null;
  return (
    <div
      data-slot="aui_message-day"
      className="my-3 mb-1.5 text-center text-xs text-muted-foreground"
    >
      {label}
    </div>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom render={<TooltipIconButton tooltip="Scroll to bottom" variant="outline" className="aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible" />}><ArrowDownIcon /></ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root mb-6 flex flex-col items-center px-4 text-center">
      <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-medium tracking-tight duration-200">
        How can I help you today?
      </h1>
    </div>
  );
};

const Composer: FC<{ autoFocus: boolean }> = ({ autoFocus }) => {
  const { placeholder, mentionSeats } = useContext(ThreadChromeContext);
  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <OfficeSkillSlash />
      {mentionSeats.length > 0 ? (
        <RoomMentionMenu seats={mentionSeats} />
      ) : null}
      <div
        data-slot="aui_composer-shell"
        className="border-border/60 focus-within:border-border dark:border-muted-foreground/15 dark:focus-within:border-muted-foreground/30 flex w-full cursor-text flex-col gap-1 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color]"
      >
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder={placeholder}
          className="aui-composer-input caret-primary text-ink placeholder:text-muted-foreground/60 max-h-40 min-h-9 w-full resize-none bg-transparent px-2 py-1 text-base leading-[1.5] outline-none min-[721px]:text-[14px]"
          rows={1}
          autoFocus={autoFocus}
          enterKeyHint="send"
          aria-label="Message input"
        />
        <ComposerAction />
      </div>
    </ComposerPrimitive.Root>
  );
};

const composerSlotIsStop = (pending: boolean) => (s: AssistantState) =>
  (s.thread.isRunning || pending) && !s.composer.text.trim();

const COMPOSER_PRIMARY_BTN =
  "size-8 rounded-full bg-ink text-on-ink hover:bg-ink disabled:bg-ink/35 disabled:text-on-ink disabled:opacity-100";

const ComposerAction: FC = () => {
  const { pending } = useContext(ThreadChromeContext);
  const stop = composerSlotIsStop(pending);
  return (
    <div className="aui-composer-action-wrapper relative flex items-center justify-between">
      <ComposerAddAttachment />
      <div className="flex items-center gap-1.5">
        <AuiIf condition={(s) => s.thread.capabilities.dictation}>
          <AuiIf condition={(s) => s.composer.dictation == null}>
            <ComposerPrimitive.Dictate render={<TooltipIconButton tooltip="Voice input" side="bottom" type="button" variant="ghost" size="icon" className="aui-composer-dictate text-muted-foreground hover:text-foreground size-7 rounded-full" aria-label="Start voice input" />}><MicIcon className="aui-composer-dictate-icon size-4" /></ComposerPrimitive.Dictate>
          </AuiIf>
          <AuiIf condition={(s) => s.composer.dictation != null}>
            <ComposerPrimitive.StopDictation render={<TooltipIconButton tooltip="Stop dictation" side="bottom" type="button" variant="ghost" size="icon" className="aui-composer-stop-dictation text-destructive size-7 rounded-full" aria-label="Stop voice input" />}><SquareIcon className="aui-composer-stop-dictation-icon size-3.5 animate-pulse fill-current" /></ComposerPrimitive.StopDictation>
          </AuiIf>
        </AuiIf>
        <AuiIf condition={stop}>
          <ComposerPrimitive.Cancel render={<TooltipIconButton tooltip="Stop now" side="bottom" type="button" variant="default" size="icon" className={`aui-composer-cancel ${COMPOSER_PRIMARY_BTN}`} aria-label="Stop now" />}><SquareIcon className="aui-composer-cancel-icon size-3.5 fill-current" /></ComposerPrimitive.Cancel>
        </AuiIf>
        <AuiIf condition={(s) => !stop(s)}>
          <ComposerPrimitive.Send render={<TooltipIconButton tooltip="Send message" side="bottom" type="button" variant="default" size="icon" className={`aui-composer-send ${COMPOSER_PRIMARY_BTN}`} aria-label="Send message" />}><ArrowUpIcon className="aui-composer-send-icon size-4" /></ComposerPrimitive.Send>
        </AuiIf>
      </div>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root">
        <ErrorPrimitive.Message className="aui-message-error-message" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

/** Thread-level waiting chrome. Do not read `s.message` — this mounts outside Messages. */
const AssistantWorkingStatus: FC<{ speaker?: string }> = ({ speaker = "" }) => {
  const { botName } = useContext(ThreadChromeContext);
  const fromLast = useAuiState((s) => {
    const last = lastThreadMessage(s);
    if (!last || last.role !== "assistant") return "";
    if (last.status?.type !== "running") return "";
    return parseRoomSpeaker(last.metadata)?.name ?? "";
  });
  return <ThinkingStatus name={speaker || fromLast || botName} />;
};

const AssistantMessage: FC = () => {
  const {
    ToolFallback: ToolFallbackComponent = ToolFallback,
    ToolGroup,
  } = useContext(ThreadComponentsContext);
  const speakerName = useAuiState(
    (s) => parseRoomSpeaker(s.message.metadata)?.name ?? "",
  );
  const toolRunning = useAuiState((s) =>
    assistantTurnHasRunningTool(s.message),
  );
  const learned = useAuiState((s) => isOfficeLearnedMessage(s.message));

  if (learned) {
    return (
      <MessagePrimitive.Root
        data-slot="office-learned"
        data-role="assistant"
        className="fade-in slide-in-from-bottom-1 animate-in relative duration-150"
      >
        <div className="office-learned px-2 py-2">
          <span className="office-learned-kicker">Learned</span>
          <MessagePrimitive.Parts>
            {({ part }) =>
              part.type === "text" ? (
                <div className="office-learned-body">
                  <MarkdownText />
                </div>
              ) : null
            }
          </MessagePrimitive.Parts>
        </div>
      </MessagePrimitive.Root>
    );
  }

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 animate-in relative duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <div
        data-slot="aui_assistant-message-content"
        className="text-foreground flex flex-col items-start gap-2 px-2 leading-[1.5] wrap-break-word"
      >
        {speakerName ? (
          <div
            data-slot="aui_message-sender"
            className="flex items-center gap-1.5"
          >
            <AvatarMark
              name={speakerName}
              color="#5b7cff"
              shape="circle"
              size="xs"
            />
            <span className="text-[12px] font-medium text-ink/80">
              {speakerName}
            </span>
          </div>
        ) : null}
        <MessagePrimitive.GroupedParts
          groupBy={groupPartByType({
            reasoning: ["group-chainOfThought", "group-reasoning"],
            "tool-call": ["group-chainOfThought", "group-tool"],
            "standalone-tool-call": [],
          })}
        >
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought": {
                const streaming = part.status.type === "running";
                return (
                  <div data-slot="aui_chain-of-thought">
                    <ReasoningRoot variant="ghost" streaming={streaming}>
                      <ReasoningTrigger active={streaming} />
                      <ReasoningContent className="mt-1" aria-busy={streaming}>
                        <div className="flex flex-col items-start gap-1">
                          {children}
                        </div>
                      </ReasoningContent>
                    </ReasoningRoot>
                  </div>
                );
              }
              case "group-tool":
                if (ToolGroup) {
                  return <ToolGroup group={part}>{children}</ToolGroup>;
                }
                return (
                  <ToolGroupRoot variant="ghost">
                    <ToolGroupTrigger
                      count={part.indices.length}
                      active={part.status.type === "running"}
                    />
                    <ToolGroupContent>{children}</ToolGroupContent>
                  </ToolGroupRoot>
                );
              case "group-reasoning":
                return (
                  <div data-slot="aui_chain-reasoning" className="min-w-0 w-full">
                    <ReasoningText>{children}</ReasoningText>
                  </div>
                );
              case "reasoning":
                return (
                  <MarkdownText
                    components={{
                      h1: ({ children }) => (
                        <p className="aui-md-p my-1.5 font-medium first:mt-0 last:mb-0">
                          {children}
                        </p>
                      ),
                      h2: ({ children }) => (
                        <p className="aui-md-p my-1.5 font-medium first:mt-0 last:mb-0">
                          {children}
                        </p>
                      ),
                      h3: ({ children }) => (
                        <p className="aui-md-p my-1.5 font-medium first:mt-0 last:mb-0">
                          {children}
                        </p>
                      ),
                      h4: ({ children }) => (
                        <p className="aui-md-p my-1.5 font-medium first:mt-0 last:mb-0">
                          {children}
                        </p>
                      ),
                      p: ({ className, ...props }) => (
                        <p
                          className={cn(
                            "aui-md-p my-1.5 leading-relaxed first:mt-0 last:mb-0",
                            className,
                          )}
                          {...props}
                        />
                      ),
                    }}
                  />
                );
              case "text":
                return (
                  <div
                    data-slot="aui_assistant-message-bubble"
                    className="aui-assistant-message-bubble w-fit max-w-[min(92%,36rem)] rounded-[14px] bg-card px-3.5 py-1.5 text-[14px] leading-[1.5] wrap-break-word empty:hidden min-[721px]:max-w-[min(72%,36rem)] light:bg-card-2 [&_.aui-md-p]:my-1"
                  >
                    <MarkdownText />
                  </div>
                );
              case "tool-call":
                if (part.toolUI) return part.toolUI;
                return <ToolFallbackComponent {...part} />;
              case "data":
                return part.dataRendererUI;
              case "file":
                return (
                  <div data-slot="aui_assistant-message-file" className="py-1">
                    <File {...part} />
                  </div>
                );
              case "image":
                return (
                  <div data-slot="aui_assistant-message-image" className="py-1">
                    <Image {...part} />
                  </div>
                );
              case "indicator":
                if (toolRunning) return null;
                return (
                  <div data-slot="aui_assistant-working">
                    <AssistantWorkingStatus speaker={speakerName} />
                  </div>
                );
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className="ms-2 flex items-center empty:hidden"
      >
        <BranchPicker />
      </div>
    </MessagePrimitive.Root>
  );
};

const UserMessage: FC = () => {
  const { viewerUserId, viewerImage } = useContext(ThreadChromeContext);
  const senderLabel = useAuiState((s) => {
    const sender = officeUserMessageSender(s.message.metadata, viewerUserId);
    return sender?.label ?? "";
  });
  const senderName = useAuiState((s) => {
    const sender = officeUserMessageSender(s.message.metadata, viewerUserId);
    return sender?.name ?? "";
  });
  const senderImage = useAuiState((s) => {
    const sender = officeUserMessageSender(s.message.metadata, viewerUserId);
    return sender?.image ?? "";
  });
  const mine = useAuiState((s) => {
    const sender = officeUserMessageSender(s.message.metadata, viewerUserId);
    return sender?.mine ?? true;
  });
  const faceName = senderName || senderLabel || "You";
  const faceImage = senderImage || (mine ? viewerImage : "");
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      data-role="user"
      data-mine={mine ? "true" : "false"}
      className={cn(
        "fade-in slide-in-from-bottom-1 animate-in flex flex-col gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]",
        mine ? "items-end" : "items-start",
      )}
    >
      <div className="aui-user-message-content-wrapper relative max-w-[min(92%,36rem)] min-[721px]:max-w-[min(72%,36rem)]">
        {senderLabel ? (
          <div
            data-slot="aui_message-sender"
            className={cn(
              "mb-1.5 flex items-center gap-1.5",
              mine ? "flex-row-reverse" : "flex-row",
            )}
          >
            <PersonAvatar
              name={faceName}
              image={faceImage || undefined}
              size="xs"
            />
            <span className="text-[12px] font-medium text-ink/80">
              {senderLabel}
            </span>
          </div>
        ) : null}
        <div className="aui-user-message-content rounded-[14px] bg-card-2 px-3.5 py-1.5 text-[14px] leading-[1.5] text-foreground wrap-break-word empty:hidden light:border light:border-line light:bg-white">
          <MessagePrimitive.Parts
            components={{
              File: () => null,
              Image: () => null,
              Text: MarkdownText,
            }}
          />
        </div>
      </div>

      <BranchPicker
        data-slot="aui_user-branch-picker"
        className={mine ? "-me-1" : "-ms-1"}
      />
    </MessagePrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className="flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <ComposerPrimitive.Root className="aui-edit-composer-root border-border/60 dark:border-muted-foreground/15 ms-auto flex w-full max-w-[min(92%,36rem)] cursor-text flex-col rounded-(--composer-radius) border bg-(--composer-bg) min-[721px]:max-w-[min(72%,36rem)]">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end">
          <ComposerPrimitive.Cancel render={<Button variant="ghost" size="sm" className="h-8 rounded-full px-3.5" />}>Cancel
                              </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send render={<Button size="sm" className="h-8 rounded-full px-3.5" />}>Update
                              </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous render={<TooltipIconButton tooltip="Previous" />}><ChevronLeftIcon /></BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next render={<TooltipIconButton tooltip="Next" />}><ChevronRightIcon /></BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
