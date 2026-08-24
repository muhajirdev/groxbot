import type {
  Bot,
  ProductEvent,
  TemplateId,
  ThreadMessage,
  WorkspaceApp,
} from "@groxbot/contracts";
import { eq, useLiveQuery } from "@tanstack/react-db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppPane } from "../components/AppPane";
import { AppSettings } from "../components/AppSettings";
import { AvatarMark } from "../components/Avatar";
import { BotSettingsPane } from "../components/BotSettingsPane";
import { ComputerPane } from "../components/ComputerPane";
import {
  ChevronLeftIcon,
  FileIcon,
  MicIcon,
  MonitorIcon,
  PlugIcon,
  PlusIcon,
  SearchIcon,
} from "../components/Icons";
import { PluginsModal } from "../components/PluginsModal";
import { ThreadList } from "../components/ThreadList";
import { APP_KIND_COLOR, APP_KIND_LABEL } from "../lib/app-kind";
import { authClient } from "../lib/auth";
import {
  appsCollection,
  botsCollection,
  clearThreadStore,
  messagesCollection,
  patchBot,
  peekBots,
  threadMetaCollection,
} from "../lib/collections";
import {
  humanizeRunError,
  isModelSetupError,
  userFacingError,
} from "../lib/errors";
import { AVATAR_COLORS, FIRST_TASK } from "../lib/jobs";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import {
  cacheBot,
  cacheCreatedBot,
  firstLiveBot,
  isArchivedBot,
} from "../lib/session";
import { applyTheme, readTheme, type Theme } from "../lib/theme";
import {
  appendOptimisticMessage,
  ensureThreadMeta,
  failOptimisticSend,
  patchThreadMeta,
  peekMessages,
  readCursor,
  touchBotPreview,
  upsertCachedMessage,
} from "../lib/thread-cache";
import { formatListTime } from "../lib/time";
import { mergeWorkspaceApps } from "../lib/workspace-apps";
import { Button, cn } from "../ui";

function asMessage(payload: Record<string, unknown>): ThreadMessage | null {
  const id = String(payload.id ?? "");
  const seq = Number(payload.seq);
  const actorType = payload.actorType;
  if (!id || !Number.isFinite(seq)) return null;
  if (actorType !== "human" && actorType !== "bot" && actorType !== "system")
    return null;
  return {
    id,
    seq,
    actorType,
    actorId: payload.actorId ? String(payload.actorId) : null,
    blocks: Array.isArray(payload.blocks)
      ? (payload.blocks as ThreadMessage["blocks"])
      : [],
    runId: payload.runId ? String(payload.runId) : null,
    createdAt: String(payload.createdAt ?? new Date().toISOString()),
  };
}

function messageText(message: ThreadMessage): string {
  return message.blocks
    .flatMap((block) => {
      if (block.kind === "text") return [block.text];
      if (block.kind === "app") return [block.title];
      return [];
    })
    .join("\n");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function BotRow(props: {
  item: Bot;
  selected: boolean;
  working: boolean;
  muted?: boolean;
}) {
  const item = props.item;
  return (
    <Link
      to="/$botId"
      params={{ botId: item.id }}
      preload="intent"
      preloadDelay={0}
      className={cn(
        "chat-conv grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border-0 bg-transparent px-2 py-2.5 text-left text-inherit no-underline",
        props.selected && "bg-selected",
        props.muted && "opacity-70",
      )}
    >
      <AvatarMark
        name={item.name}
        color={item.avatarColor}
        shape={item.avatarShape}
        mood={props.working ? "working" : "idle"}
      />
      <span className="chat-conv-copy min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">{item.name}</span>
          <span className="shrink-0 text-[11px] whitespace-nowrap text-muted">
            {formatListTime(item.lastAt)}
          </span>
        </span>
        <div className="mt-0.5 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">
          {item.lastPreview || item.title || "No messages yet"}
        </div>
      </span>
    </Link>
  );
}

function AppRow(props: {
  item: WorkspaceApp;
  selected: boolean;
  onOpen: () => void;
}) {
  const item = props.item;
  return (
    <button
      type="button"
      className={cn(
        "chat-conv grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border-0 bg-transparent px-2 py-2.5 text-left text-inherit",
        props.selected && "bg-selected",
      )}
      onClick={props.onOpen}
    >
      <span
        className="grid size-8 shrink-0 place-items-center rounded-[10px] text-white"
        style={{ background: APP_KIND_COLOR[item.templateId] }}
      >
        <FileIcon />
      </span>
      <span className="chat-conv-copy min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold">{item.title}</span>
          <span className="shrink-0 text-[11px] whitespace-nowrap text-muted">
            {formatListTime(item.createdAt)}
          </span>
        </span>
        <div className="mt-0.5 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">
          {APP_KIND_LABEL[item.templateId]}
        </div>
      </span>
    </button>
  );
}

export function Chat(props: { botId: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const botsQuery = useLiveQuery((q) => q.from({ bot: botsCollection }));
  const appsQuery = useLiveQuery((q) => q.from({ app: appsCollection }));
  const meQuery = useQuery(orpc.me.queryOptions());
  const liveBotsRows = botsQuery.data ?? [];
  const peekedBots = peekBots();
  const bots =
    liveBotsRows.length > 0 || peekedBots.length === 0
      ? liveBotsRows
      : peekedBots;
  const me = meQuery.data;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "models">(
    "general",
  );
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [paneMode, setPaneMode] = useState<
    "computer" | "settings" | "app" | null
  >(null);
  const [openApp, setOpenApp] = useState<{
    id: string;
    title: string;
    templateId: TemplateId;
  } | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme());
  const [pokeView, setPokeView] = useState<{
    threadId: string;
    peerName: string;
  } | null>(null);
  const [pokeMessages, setPokeMessages] = useState<ThreadMessage[]>([]);
  const bot =
    bots.find((item) => item.id === props.botId) ?? firstLiveBot(bots);
  const activeId = bot?.id;
  const draft = activeId ? (drafts[activeId] ?? "") : "";
  const messagesQuery = useLiveQuery(
    (q) => {
      if (!activeId) return undefined;
      return q
        .from({ message: messagesCollection })
        .where(({ message }) => eq(message.botId, activeId))
        .orderBy(({ message }) => message.seq, "asc");
    },
    [activeId],
  );
  const metaQuery = useLiveQuery(
    (q) => {
      if (!activeId) return undefined;
      return q
        .from({ meta: threadMetaCollection })
        .where(({ meta }) => eq(meta.botId, activeId))
        .findOne();
    },
    [activeId],
  );
  const liveMessages = messagesQuery.data ?? [];
  const peeked = activeId ? peekMessages(activeId) : [];
  const messages =
    liveMessages.length > 0 || peeked.length === 0 ? liveMessages : peeked;
  const working =
    metaQuery.data?.working ??
    (activeId ? threadMetaCollection.get(activeId)?.working : undefined) ??
    "";
  const error =
    metaQuery.data?.error ??
    (activeId ? threadMetaCollection.get(activeId)?.error : undefined) ??
    "";
  const statusLabel = working ? "Working" : "Idle";
  const activity = useMemo(
    () =>
      messages
        .filter((item) => item.actorType === "bot")
        .slice(-8)
        .reverse()
        .map((item) => ({ id: item.id, text: messageText(item).slice(0, 200) }))
        .filter((item) => item.text),
    [messages],
  );
  const computerPreview = working || activity[0]?.text || undefined;
  const q = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (item: Bot) => !q || item.name.toLowerCase().includes(q),
    [q],
  );
  const liveBots = useMemo(() => {
    return bots
      .filter((item) => !isArchivedBot(item) && matchesSearch(item))
      .sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
      );
  }, [bots, matchesSearch]);
  const archivedBots = useMemo(() => {
    return bots
      .filter((item) => isArchivedBot(item) && matchesSearch(item))
      .sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
      );
  }, [bots, matchesSearch]);
  const showArchived = archivedOpen || Boolean(q) || Boolean(bot?.archivedAt);
  const listedApps = appsQuery.data ?? [];
  const workspaceApps = useMemo(
    () => mergeWorkspaceApps(listedApps, messages),
    [listedApps, messages],
  );
  const visibleApps = useMemo(() => {
    return workspaceApps.filter((item) => {
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        APP_KIND_LABEL[item.templateId].toLowerCase().includes(q)
      );
    });
  }, [workspaceApps, q]);

  useEffect(() => {
    if (bot?.archivedAt) setArchivedOpen(true);
  }, [bot?.archivedAt]);

  const liveAppKey = useMemo(
    () =>
      messages
        .flatMap((message) =>
          message.blocks.flatMap((block) =>
            block.kind === "app" ? [block.appId] : [],
          ),
        )
        .join("|"),
    [messages],
  );
  useEffect(() => {
    if (!liveAppKey) return;
    void queryClient.invalidateQueries({
      queryKey: orpc.apps.list.queryOptions().queryKey,
    });
  }, [liveAppKey, queryClient]);

  useEffect(() => {
    if (!me?.workspaceId) return;
    void appsCollection.utils.refetch();
  }, [me?.workspaceId]);

  function setDraft(text: string) {
    if (!activeId) return;
    setDrafts((current) => ({ ...current, [activeId]: text }));
  }

  async function refreshBots(selectId?: string) {
    await botsCollection.utils.refetch();
    const next = selectId ?? props.botId ?? firstLiveBot(peekBots())?.id;
    if (next && next !== props.botId) {
      await navigate({ to: "/$botId", params: { botId: next } });
    }
  }

  async function applyArchiveChange(next: Bot) {
    cacheBot(next);
    if (!next.archivedAt) {
      if (next.id !== props.botId) {
        await navigate({ to: "/$botId", params: { botId: next.id } });
      }
      return;
    }
    const fallback =
      firstLiveBot(peekBots().filter((item) => item.id !== next.id)) ?? next;
    if (fallback.id !== props.botId) {
      await navigate({ to: "/$botId", params: { botId: fallback.id } });
      setPaneMode(null);
    }
  }

  const hire = useCallback(async () => {
    setNewOpen(false);
    try {
      const created = await client.bots.create({
        name: "New Bot",
        avatarColor: AVATAR_COLORS[0],
      });
      await cacheCreatedBot(created);
      void navigate({ to: "/$botId", params: { botId: created.id } });
      setOpenApp(null);
      setPaneMode("settings");
    } catch (caught) {
      if (!activeId) return;
      patchThreadMeta(activeId, {
        error: caught instanceof Error ? caught.message : "Could not create",
      });
    }
  }, [activeId, navigate]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void hire();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        setSettingsTab("general");
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hire]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset overlay when the office changes
  useEffect(() => {
    setPokeView(null);
    setPokeMessages([]);
  }, [activeId]);

  useEffect(() => {
    if (!pokeView) {
      setPokeMessages([]);
      return;
    }
    let cancelled = false;
    let iterator: AsyncIterator<ProductEvent> | undefined;
    void (async () => {
      try {
        const view = await client.threads.get({ threadId: pokeView.threadId });
        if (cancelled) return;
        setPokeMessages(view.messages);
        iterator = (await client.threads.subscribe({
          threadId: pokeView.threadId,
          cursor: view.messages.at(-1)?.seq ?? -1,
        })) as AsyncIterator<ProductEvent>;
        for (;;) {
          const next = await iterator.next();
          if (cancelled || next.done) break;
          if (next.value.type !== "message.created") continue;
          const message = asMessage(next.value.payload);
          if (!message) continue;
          setPokeMessages((current) =>
            current.some((row) => row.id === message.id)
              ? current
              : [...current, message],
          );
        }
      } catch (caught: unknown) {
        if (!cancelled && activeId) {
          patchThreadMeta(activeId, {
            error:
              caught instanceof Error
                ? caught.message
                : "Could not open thread",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      void iterator?.return?.();
    };
  }, [pokeView, activeId]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    let iterator: AsyncIterator<ProductEvent> | undefined;
    let cursor = readCursor(activeId);
    ensureThreadMeta(activeId);
    void (async () => {
      iterator = (await client.threads.subscribe({
        botId: activeId,
        cursor,
      })) as AsyncIterator<ProductEvent>;
      for (;;) {
        const next = await iterator.next();
        if (cancelled || next.done) break;
        const event = next.value;
        cursor = event.seq;
        let patched = false;
        if (event.type === "message.created") {
          const message = asMessage(event.payload);
          if (message) {
            upsertCachedMessage(activeId, message);
            patchThreadMeta(activeId, { cursor });
            patched = true;
            touchBotPreview(activeId, messageText(message));
          }
        }
        if (event.type === "run.updated") {
          const status = String(event.payload.status ?? "");
          const text = String(event.payload.text ?? "");
          if (status === "running" || status === "queued") {
            patchThreadMeta(activeId, {
              working: text || "working…",
              error: "",
              cursor,
            });
          } else if (status === "failed") {
            patchThreadMeta(activeId, {
              working: "",
              error: humanizeRunError(text.trim() || "Run failed"),
              cursor,
            });
          } else {
            patchThreadMeta(activeId, { working: "", cursor });
          }
          patched = true;
        }
        if (!patched) patchThreadMeta(activeId, { cursor });
        if (event.type === "guest.updated") {
          patchBot(activeId, {
            guestOnline: Boolean(event.payload.connected),
          });
        }
      }
    })().catch((caught: unknown) => {
      if (!cancelled) {
        patchThreadMeta(activeId, {
          error: caught instanceof Error ? caught.message : "Lost the thread",
        });
      }
    });
    return () => {
      cancelled = true;
      void iterator?.return?.();
    };
  }, [activeId]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!bot || !draft.trim()) return;
    if (bot.archivedAt) return;
    if (me?.needsModel) {
      setSettingsTab("models");
      setSettingsOpen(true);
      patchThreadMeta(bot.id, {
        error:
          "Add a model key, or use Groxbot’s included gateway, to talk to teammates.",
      });
      return;
    }
    const text = draft.trim();
    setDraft("");
    const optimistic = appendOptimisticMessage(bot.id, text);
    try {
      await client.threads.send({ botId: bot.id, text });
    } catch (caught) {
      const message = userFacingError(caught, "Could not send");
      failOptimisticSend(bot.id, optimistic.id, message);
      setDraft(text);
      if (isModelSetupError(message)) {
        setSettingsTab("models");
        setSettingsOpen(true);
      }
    }
  }

  const openDocument = useCallback(
    (app: { appId: string; title: string; templateId: TemplateId }) => {
      setOpenApp({
        id: app.appId,
        title: app.title,
        templateId: app.templateId,
      });
      setPaneMode("app");
    },
    [],
  );

  const openComputer = useCallback(() => {
    setOpenApp(null);
    setPaneMode("computer");
  }, []);

  return (
    <div
      className={cn(
        "chat-shell relative grid h-screen bg-bg",
        paneMode === "app"
          ? "grid-cols-[280px_minmax(260px,0.9fr)_minmax(420px,1.2fr)]"
          : paneMode
            ? "grid-cols-[280px_minmax(0,1fr)_320px]"
            : "grid-cols-[280px_minmax(0,1fr)]",
      )}
    >
      <aside className="flex min-h-0 flex-col border-r border-line bg-bg-side px-2.5 pb-2">
        <div className="flex flex-col gap-2 px-0.5 pt-1.5 pb-2.5">
          <div className="side-chrome drag flex min-h-9 items-center">
            <div className="min-w-0 flex-1" />
            <div className="no-drag relative shrink-0">
              <Button
                variant="icon"
                type="button"
                aria-label="New"
                onClick={() => setNewOpen((open) => !open)}
              >
                <PlusIcon />
              </Button>
              {newOpen ? (
                <div className="menu">
                  <button type="button" onClick={() => void hire()}>
                    Create new agent
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <label className="search-field">
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
            />
          </label>
        </div>
        <div className="grid flex-1 content-start gap-0.5 overflow-auto px-1">
          {liveBots.map((item) => (
            <BotRow
              key={item.id}
              item={item}
              selected={item.id === bot?.id}
              working={item.id === bot?.id && Boolean(working)}
            />
          ))}
          {liveBots.length === 0 && archivedBots.length === 0 ? (
            <p className="empty">No teammates yet.</p>
          ) : null}
          {visibleApps.length > 0 ? (
            <div className="mt-2">
              <div className="px-2 py-2 text-[12px] text-muted">Apps</div>
              {visibleApps.map((item) => (
                <AppRow
                  key={item.id}
                  item={item}
                  selected={paneMode === "app" && openApp?.id === item.id}
                  onOpen={() => {
                    setPokeView(null);
                    openDocument({
                      appId: item.id,
                      title: item.title,
                      templateId: item.templateId,
                    });
                  }}
                />
              ))}
            </div>
          ) : null}
          {archivedBots.length > 0 ? (
            <div className="mt-2">
              <button
                className="flex w-full items-center justify-between rounded-xl border-0 bg-transparent px-2 py-2 text-left text-[12px] text-muted hover:bg-hover"
                type="button"
                onClick={() => setArchivedOpen((open) => !open)}
              >
                <span>Archived</span>
                <span>{archivedBots.length}</span>
              </button>
              {showArchived
                ? archivedBots.map((item) => (
                    <BotRow
                      key={item.id}
                      item={item}
                      selected={item.id === bot?.id}
                      working={false}
                      muted
                    />
                  ))
                : null}
            </div>
          ) : null}
        </div>
        <div className="chat-foot mt-auto grid gap-1 px-1.5 pt-2 pb-1">
          <button
            className="flex w-full items-center gap-2.5 rounded-xl border-0 bg-transparent px-2 py-2 text-left text-inherit hover:bg-hover"
            type="button"
            onClick={() => setPluginsOpen(true)}
          >
            <PlugIcon />
            <span>Plugins</span>
          </button>
          <button
            className="flex w-full items-center gap-2.5 rounded-xl border-0 bg-transparent px-2 py-2 text-left text-inherit hover:bg-hover"
            type="button"
            onClick={() => {
              setSettingsTab("general");
              setSettingsOpen(true);
            }}
          >
            <span
              className="avatar circle"
              style={{ background: "#4d5568", width: 28, height: 28 }}
            >
              {initials(me?.name ?? "You")}
            </span>
            <span>{me?.name || "You"}</span>
          </button>
        </div>
      </aside>
      <section className="flex min-h-0 flex-col bg-bg-thread">
        <div className="thread-head drag flex items-center justify-between gap-2 border-b border-line px-[18px] py-2.5">
          {pokeView ? (
            <button
              className="no-drag flex items-center gap-2.5 border-0 bg-transparent p-0 text-inherit"
              type="button"
              onClick={() => setPokeView(null)}
            >
              <ChevronLeftIcon />
              <strong className="text-[15px] font-semibold tracking-tight">
                {bot?.name ?? "—"} · {pokeView.peerName}
              </strong>
            </button>
          ) : (
            <button
              className="no-drag flex items-center gap-2.5 border-0 bg-transparent p-0 text-inherit"
              type="button"
              onClick={() => {
                setOpenApp(null);
                setPaneMode("settings");
              }}
            >
              {bot ? (
                <AvatarMark
                  name={bot.name}
                  color={bot.avatarColor}
                  shape={bot.avatarShape}
                  mood={working ? "working" : "idle"}
                  size="sm"
                  hero
                />
              ) : null}
              <strong className="text-[15px] font-semibold tracking-tight">
                {bot?.name ?? "—"}
              </strong>
            </button>
          )}
          <div className="no-drag flex flex-wrap items-center gap-1.5">
            {working ? (
              <Button
                variant="mini"
                type="button"
                onClick={() =>
                  bot && void client.threads.stop({ botId: bot.id })
                }
              >
                Stop now
              </Button>
            ) : null}
            <Button
              variant="icon"
              type="button"
              aria-label="Computer"
              title="Computer"
              on={paneMode === "computer"}
              onClick={() => {
                if (paneMode === "computer") {
                  setPaneMode(null);
                  return;
                }
                openComputer();
              }}
            >
              <MonitorIcon />
            </Button>
          </div>
        </div>
        {me?.needsModel || me?.modelWarning ? (
          <div className="mx-5 mb-2 flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-[13px]">
            <span>
              {me?.needsModel
                ? "Add a model key, or use Groxbot’s included gateway, to talk to teammates."
                : me?.modelWarning}
            </span>
            <Button
              variant="text"
              type="button"
              onClick={() => {
                setSettingsTab("models");
                setSettingsOpen(true);
              }}
            >
              Open models
            </Button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          <ThreadList
            botId={pokeView ? "_" : (activeId ?? "_")}
            teammateNames={Object.fromEntries(
              bots.map((item) => [item.id, item.name]),
            )}
            messages={pokeView ? pokeMessages : messages}
            empty={
              pokeView
                ? pokeMessages.length === 0
                : !working && messages.length === 0
            }
            computer={
              pokeView || !bot
                ? null
                : {
                    title: working || `${bot.name}'s computer`,
                    status: statusLabel,
                    done: !working,
                    preview: computerPreview,
                  }
            }
            working={pokeView ? "" : working}
            onOpenComputer={openComputer}
            onOpenApp={openDocument}
            onOpenPokeThread={(threadId, peerName) =>
              setPokeView({ threadId, peerName })
            }
          />
        </div>
        <div className="px-5 pt-2 pb-[18px]">
          {error ? (
            <p className="mb-2 text-[13px] text-danger">{error}</p>
          ) : null}
          {pokeView ? (
            <p className="mb-1 px-1 text-[13px] text-muted">
              {bot?.name} and {pokeView.peerName} talking. Back to stay with{" "}
              {bot?.name}.
            </p>
          ) : bot?.archivedAt ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-[13px]">
              <span>Archived. Unarchive to keep working with {bot.name}.</span>
              <Button
                variant="text"
                type="button"
                onClick={() => {
                  void client.bots
                    .unarchive({ botId: bot.id })
                    .then(applyArchiveChange)
                    .catch((caught: unknown) =>
                      patchThreadMeta(bot.id, {
                        error: userFacingError(caught, "Could not unarchive"),
                      }),
                    );
                }}
              >
                Unarchive
              </Button>
            </div>
          ) : (
            <form
              className="grid grid-cols-[auto_1fr_auto] items-end gap-1.5 rounded-pill border border-[#262626] bg-[#141414] py-1.5 pr-2 pl-2.5 light:border-line light:bg-white"
              onSubmit={(event) => void send(event)}
            >
              <Button
                variant="icon"
                className="size-[34px] rounded-pill"
                type="button"
                aria-label="Attach"
                title="Attach"
              >
                <PlusIcon />
              </Button>
              <textarea
                rows={1}
                className="max-h-[140px] min-h-6 resize-none border-0 bg-transparent px-1 py-2 outline-none"
                value={draft}
                placeholder={
                  me?.needsModel
                    ? "Add a model key to send"
                    : messages.length === 0
                      ? FIRST_TASK
                      : bot
                        ? `Message ${bot.name}`
                        : "Message"
                }
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <Button
                variant="icon"
                className="size-[34px] rounded-pill"
                type="button"
                aria-label="Voice"
                title="Voice"
              >
                <MicIcon />
              </Button>
            </form>
          )}
        </div>
      </section>
      {paneMode === "app" && openApp ? (
        <AppPane
          appId={openApp.id}
          title={openApp.title}
          templateId={openApp.templateId}
          onCollapse={() => {
            setPaneMode(null);
            setOpenApp(null);
          }}
        />
      ) : null}
      {paneMode === "computer" && bot ? (
        <ComputerPane
          bot={bot}
          statusLabel={statusLabel}
          working={working}
          activity={activity}
          onSettings={() => {
            setOpenApp(null);
            setPaneMode("settings");
          }}
          onCollapse={() => setPaneMode(null)}
        />
      ) : null}
      {paneMode === "settings" && bot ? (
        <BotSettingsPane
          bot={bot}
          onCollapse={() => setPaneMode(null)}
          onSaved={async () => {
            await refreshBots(bot.id);
          }}
          onArchiveChange={applyArchiveChange}
        />
      ) : null}
      {pluginsOpen ? (
        <PluginsModal onClose={() => setPluginsOpen(false)} />
      ) : null}
      {settingsOpen ? (
        <AppSettings
          me={me}
          theme={theme}
          initialTab={settingsTab}
          onTheme={(value) => {
            setTheme(value);
            applyTheme(value);
          }}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsTab("general");
          }}
          onSignOut={() => {
            void (async () => {
              await authClient.signOut();
              clearThreadStore();
              queryClient.clear();
              await router.invalidate();
              await navigate({ to: "/" });
            })();
          }}
        />
      ) : null}
    </div>
  );
}
