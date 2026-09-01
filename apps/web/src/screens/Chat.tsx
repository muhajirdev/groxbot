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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppPane } from "../components/AppPane";
import { AppSettings } from "../components/AppSettings";
import { AvatarMark } from "../components/Avatar";
import { BotSettingsPane } from "../components/BotSettingsPane";
import { ComputerPane } from "../components/ComputerPane";
import {
  ChevronLeftIcon,
  FileIcon,
  GearIcon,
  MicIcon,
  MonitorIcon,
  PlugIcon,
  PlusIcon,
  SearchIcon,
} from "../components/Icons";
import { HireDialog } from "../components/HireDialog";
import { PluginsModal } from "../components/PluginsModal";
import { ThinkThread } from "../components/ThinkThread";
import { ThreadList } from "../components/ThreadList";
import { APP_KIND_COLOR, APP_KIND_LABEL } from "../lib/app-kind";
import { authClient } from "../lib/auth";
import {
  appsCollection,
  botsCollection,
  clearThreadStore,
  patchBot,
  peekBots,
  removeBot,
  threadMetaCollection,
} from "../lib/collections";
import { userFacingError } from "../lib/errors";
import {
  draftCreatedBot,
  nextAvatarColor,
} from "../lib/hire";
import { FIRST_TASK } from "../lib/jobs";
import { orpc } from "../lib/orpc";
import { usePanePresence } from "../lib/presence";
import { client } from "../lib/rpc";
import {
  cacheBot,
  cacheCreatedBot,
  firstLiveBot,
  isArchivedBot,
} from "../lib/session";
import { setThinkMessages } from "../lib/think-messages";
import { applyTheme, readTheme, type Theme } from "../lib/theme";
import {
  ensureThreadMeta,
  patchThreadMeta,
  readCursor,
} from "../lib/thread-cache";
import { formatListTime } from "../lib/time";
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function neighborBotId(
  ids: string[],
  current: string | undefined,
  delta: 1 | -1,
): string | undefined {
  if (ids.length === 0) return undefined;
  const index = current ? ids.indexOf(current) : -1;
  if (index < 0) return delta > 0 ? ids[0] : ids[ids.length - 1];
  return ids[(index + delta + ids.length) % ids.length];
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
      preloadDelay={300}
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
        {item.lastPreview || item.title ? (
          <div className="mt-0.5 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">
            {item.lastPreview || item.title}
          </div>
        ) : null}
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
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "models">(
    "general",
  );
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [paneMode, setPaneMode] = useState<
    "settings" | "app" | "computer" | null
  >(null);
  const [openApp, setOpenApp] = useState<{
    id: string;
    title: string;
    templateId: TemplateId;
  } | null>(null);
  const lastApp = useRef(openApp);
  if (openApp) lastApp.current = openApp;
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme());
  const [pokeView, setPokeView] = useState<{
    threadId: string;
    peerName: string;
  } | null>(null);
  const [thinkBusy, setThinkBusy] = useState(false);
  const stopThink = useRef<(() => void) | null>(null);
  const hiring = useRef(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [pokeMessages, setPokeMessages] = useState<ThreadMessage[]>([]);
  const bot =
    (creatingId
      ? bots.find((item) => item.id === creatingId)
      : undefined) ?? bots.find((item) => item.id === props.botId);
  const hiringThis = Boolean(creatingId && bot?.id === creatingId);
  const activeId = bot?.id;
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
  const streamWorking =
    metaQuery.data?.working ??
    (activeId ? threadMetaCollection.get(activeId)?.working : undefined) ??
    "";
  const working = pokeView ? streamWorking : thinkBusy ? "working…" : "";
  const error =
    metaQuery.data?.error ??
    (activeId ? threadMetaCollection.get(activeId)?.error : undefined) ??
    "";
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
  const workspaceApps = appsQuery.data ?? [];
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

  useEffect(() => {
    if (!me?.workspaceId) return;
    void appsCollection.utils.refetch();
  }, [me?.workspaceId]);

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

  const hire = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || hiring.current) return;
      hiring.current = true;
      setHireOpen(false);
      const id = crypto.randomUUID();
      const roster = peekBots();
      const avatarColor = nextAvatarColor(roster);
      const draft = draftCreatedBot({
        id,
        workspaceId: meQuery.data?.workspaceId ?? id,
        name: trimmed,
        avatarColor,
      });
      try {
        await cacheCreatedBot(draft);
        setThinkMessages(id, []);
        setCreatingId(id);
        setOpenApp(null);
        setPaneMode(null);
        void navigate({ to: "/$botId", params: { botId: id } });
        const created = await client.bots.create({
          id,
          name: trimmed,
          avatarColor,
        });
        cacheBot(created);
      } catch (caught) {
        removeBot(id);
        setCreatingId(null);
        const fallback = firstLiveBot(peekBots());
        if (fallback) {
          patchThreadMeta(fallback.id, {
            error: userFacingError(caught, "Could not create"),
          });
          if (fallback.id !== props.botId) {
            void navigate({ to: "/$botId", params: { botId: fallback.id } });
          }
        }
      } finally {
        hiring.current = false;
        setCreatingId((current) => (current === id ? null : current));
      }
    },
    [meQuery.data?.workspaceId, navigate, props.botId],
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        if (!hiring.current) setHireOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        if (hireOpen) return;
        setSettingsTab("general");
        setSettingsOpen(true);
      }
      if (
        (event.key === "ArrowDown" || event.key === "ArrowUp") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !settingsOpen &&
        !pluginsOpen &&
        !hireOpen &&
        !isTypingTarget(event.target)
      ) {
        const nextId = neighborBotId(
          liveBots.map((item) => item.id),
          activeId,
          event.key === "ArrowDown" ? 1 : -1,
        );
        if (!nextId || nextId === activeId) return;
        event.preventDefault();
        void navigate({ to: "/$botId", params: { botId: nextId } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [liveBots, activeId, navigate, settingsOpen, pluginsOpen, hireOpen]);

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
    if (!activeId || hiringThis) return;
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
        patchThreadMeta(activeId, { cursor });
        if (event.type === "guest.updated") {
          patchBot(activeId, {
            guestOnline: Boolean(event.payload.connected),
          });
        }
      }
    })().catch((caught: unknown) => {
      if (!cancelled) {
        console.warn("office events", caught);
      }
    });
    return () => {
      cancelled = true;
      void iterator?.return?.();
    };
  }, [activeId, hiringThis]);

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

  const activePane =
    paneMode === "app" && openApp
      ? "app"
      : paneMode === "settings" && bot
        ? "settings"
        : paneMode === "computer" && bot
          ? "computer"
          : null;
  const pane = usePanePresence(activePane);
  const exitingApp = openApp ?? lastApp.current;

  return (
    <div
      className={cn(
        "chat-shell relative h-screen bg-bg",
        paneMode === "app" && "is-app",
        paneMode && paneMode !== "app" && "is-pane",
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
                aria-busy={hiringThis}
                disabled={hiringThis}
                on={hireOpen}
                onClick={() => setHireOpen(true)}
              >
                <PlusIcon />
              </Button>
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
              working={
                item.id === creatingId ||
                (item.id === bot?.id && Boolean(working))
              }
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
                  mood={
                    hiringThis || working ? "working" : "idle"
                  }
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
            {working && !pokeView ? (
              <Button
                variant="mini"
                type="button"
                onClick={() => stopThink.current?.()}
              >
                Stop now
              </Button>
            ) : null}
            {bot && !pokeView ? (
              <>
                <Button
                  variant="icon"
                  type="button"
                  aria-label="Open computer"
                  title="Computer"
                  on={paneMode === "computer"}
                  onClick={() => {
                    setOpenApp(null);
                    setPaneMode((mode) =>
                      mode === "computer" ? null : "computer",
                    );
                  }}
                >
                  <MonitorIcon />
                </Button>
                <Button
                  variant="icon"
                  type="button"
                  aria-label="Bot settings"
                  title="Settings"
                  on={paneMode === "settings"}
                  onClick={() => {
                    setOpenApp(null);
                    setPaneMode((mode) =>
                      mode === "settings" ? null : "settings",
                    );
                  }}
                >
                  <GearIcon />
                </Button>
              </>
            ) : null}
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
        {pokeView ? (
          <>
            <div className="min-h-0 flex-1">
              <ThreadList
                botId="_"
                teammateNames={Object.fromEntries(
                  bots.map((item) => [item.id, item.name]),
                )}
                messages={pokeMessages}
                empty={pokeMessages.length === 0}
                working=""
                onOpenApp={openDocument}
              />
            </div>
            <div className="px-5 pt-2 pb-[18px]">
              {error ? (
                <p className="mb-2 text-[13px] text-danger">{error}</p>
              ) : null}
              <p className="mb-1 px-1 text-[13px] text-muted">
                {bot?.name} and {pokeView.peerName} talking. Back to stay with{" "}
                {bot?.name}.
              </p>
            </div>
          </>
        ) : bot && hiringThis ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-7 pt-2.5 pb-6">
              <p className="mb-6 text-base leading-normal text-muted">
                First message is a real task. A good handoff has an outcome,
                sources, and when to stop.
              </p>
            </div>
            <div className="px-5 pt-2 pb-[18px]">
              <div className="flex items-end gap-0.5 rounded-pill border border-[#262626] bg-[#141414] p-1 opacity-60 light:border-line light:bg-white">
                <Button
                  variant="icon"
                  className="size-9 shrink-0 rounded-pill text-muted"
                  type="button"
                  disabled
                  aria-label="Attach"
                >
                  <PlusIcon />
                </Button>
                <textarea
                  rows={1}
                  disabled
                  className="box-border min-h-9 max-h-[140px] flex-1 resize-none border-0 bg-transparent px-1.5 py-2 !text-[15px] !leading-5 outline-none placeholder:text-muted"
                  placeholder={FIRST_TASK}
                  value=""
                />
                <Button
                  variant="icon"
                  className="size-9 shrink-0 rounded-pill text-muted"
                  type="button"
                  disabled
                  aria-label="Voice"
                >
                  <MicIcon />
                </Button>
              </div>
            </div>
          </div>
        ) : bot ? (
          <ThinkThread
            key={bot.id}
            botId={bot.id}
            botName={bot.name}
            archived={Boolean(bot.archivedAt)}
            needsModel={Boolean(me?.needsModel)}
            placeholder={
              me?.needsModel
                ? "Add a model key to send"
                : `Message ${bot.name}`
            }
            error={error}
            onBusy={setThinkBusy}
            onError={(message) =>
              patchThreadMeta(bot.id, { error: message })
            }
            onNeedsModel={() => {
              setSettingsTab("models");
              setSettingsOpen(true);
            }}
            onUnarchive={() => {
              void client.bots
                .unarchive({ botId: bot.id })
                .then(applyArchiveChange)
                .catch((caught: unknown) =>
                  patchThreadMeta(bot.id, {
                    error: userFacingError(caught, "Could not unarchive"),
                  }),
                );
            }}
            stopRef={stopThink}
          />
        ) : null}
      </section>
      <div
        className={cn("chat-pane-slot", pane.leaving && "is-leaving")}
        aria-hidden={!activePane}
      >
        {pane.rendered === "app" && exitingApp ? (
          <AppPane
            appId={exitingApp.id}
            title={exitingApp.title}
            templateId={exitingApp.templateId}
            onCollapse={() => setPaneMode(null)}
          />
        ) : null}
        {pane.rendered === "settings" && bot ? (
          <BotSettingsPane
            key={bot.id}
            bot={bot}
            pending={hiringThis}
            onCollapse={() => setPaneMode(null)}
            onSaved={async () => {
              await refreshBots(bot.id);
            }}
            onArchiveChange={applyArchiveChange}
          />
        ) : null}
        {pane.rendered === "computer" && bot ? (
          <ComputerPane
            key={bot.id}
            bot={bot}
            onSettings={() => {
              setOpenApp(null);
              setPaneMode("settings");
            }}
            onCollapse={() => setPaneMode(null)}
          />
        ) : null}
      </div>
      <PluginsModal
        open={pluginsOpen}
        onClose={() => setPluginsOpen(false)}
      />
      <AppSettings
        open={settingsOpen}
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
      <HireDialog
        open={hireOpen}
        onClose={() => setHireOpen(false)}
        onHire={(name) => void hire(name)}
      />
    </div>
  );
}
