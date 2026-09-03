import type {
  Bot,
  ProductEvent,
  ThreadMessage,
  WorkspaceApp,
} from "@groxbot/contracts";
import { eq, useLiveQuery } from "@tanstack/react-db";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppPane } from "../components/AppPane";
import { AppSettings } from "../components/AppSettings";
import { AvatarMark } from "../components/Avatar";
import { BotSettingsPane } from "../components/BotSettingsPane";
import {
  ComputerFileOpenProvider,
  KnowledgeFileOpenProvider,
} from "../components/ChatFileLink";
import { CommandPalette, SearchTrigger } from "../components/CommandPalette";
import { ComputerPane } from "../components/ComputerPane";
import { HireDialog } from "../components/HireDialog";
import {
  ChevronLeftIcon,
  CloseIcon,
  FileIcon,
  GearIcon,
  KnowledgeIcon,
  MonitorIcon,
  MoreIcon,
  PinIcon,
  PlugIcon,
  PlusIcon,
  TrashIcon,
} from "../components/Icons";
import { KnowledgeModal } from "../components/KnowledgeModal";
import { PersonAvatar } from "../components/PersonAvatar";
import { PluginsModal } from "../components/PluginsModal";
import { KeptThinkThread } from "../components/ThinkThread";
import { ThreadList } from "../components/ThreadList";
import { WorkspaceSwitcher } from "../components/WorkspaceSwitcher";
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
import { neighborBotId, type PaletteActionId } from "../lib/command-palette";
import { userFacingError } from "../lib/errors";
import { draftCreatedBot, nextAvatarColor } from "../lib/hire";
import {
  deskApp,
  deskClosed,
  deskComputer,
  deskSettings,
  type OfficeSearch,
  officeSearch,
  toggleDesk,
} from "../lib/office-search";
import { orpc } from "../lib/orpc";
import { usePanePresence } from "../lib/presence";
import { client } from "../lib/rpc";
import {
  cacheBot,
  cacheCreatedBot,
  firstLiveBot,
  isArchivedBot,
} from "../lib/session";
import {
  type BotMenuPhase,
  botMenuBox,
  botMenuItems,
  compareSidebarBots,
  isPinnedBot,
  nextBotIdAfterDelete,
} from "../lib/sidebar";
import { applyTheme, readTheme, type Theme } from "../lib/theme";
import {
  dropThinkKeepAlive,
  rememberThinkKeepAlive,
  sameThinkKeepAlive,
} from "../lib/think-keepalive";
import { forgetThinkMessages, setThinkMessages } from "../lib/think-messages";
import {
  dropThreadMeta,
  ensureThreadMeta,
  patchThreadMeta,
  readCursor,
  readThreadMeta,
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

const BotRow = memo(function BotRow(props: {
  item: Bot;
  selected: boolean;
  working: boolean;
  muted?: boolean;
  desk: OfficeSearch;
  workspaceSlug: string;
  onMenu: (event: MouseEvent, bot: Bot) => void;
  onPick?: () => void;
}) {
  const item = props.item;
  const pinned = isPinnedBot(item);
  return (
    <div className="group/bot relative">
      <Link
        to="/$workspaceSlug/bot/$botId"
        params={{ workspaceSlug: props.workspaceSlug, botId: item.id }}
        search={props.desk}
        preload="intent"
        preloadDelay={300}
        className={cn(
          "chat-conv grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border-0 bg-transparent px-2 py-2.5 text-left text-inherit no-underline",
          props.selected && "bg-selected",
          props.muted && "opacity-70",
        )}
        aria-label={pinned ? `${item.name}, pinned` : item.name}
        onClick={props.onPick}
        onContextMenu={(event) => {
          event.preventDefault();
          props.onMenu(event, item);
        }}
      >
        <span className="relative inline-grid shrink-0">
          <AvatarMark
            name={item.name}
            color={item.avatarColor}
            shape={item.avatarShape}
            mood={props.working ? "working" : "idle"}
          />
          {pinned ? (
            <span
              className="chat-conv-pin pointer-events-none absolute -right-px -bottom-px hidden size-3.5 place-items-center rounded-full bg-bg-side text-muted min-[721px]:max-[960px]:grid"
              title="Pinned"
            >
              <PinIcon className="size-2.5" weight="fill" />
            </span>
          ) : null}
        </span>
        <span className="chat-conv-copy min-w-0">
          <span className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate text-sm font-semibold">
                {item.name}
              </span>
              {pinned ? (
                <PinIcon className="size-3 shrink-0 text-muted" weight="fill" />
              ) : null}
            </span>
            <span className="chat-conv-time shrink-0 text-[11px] whitespace-nowrap text-muted group-hover/bot:invisible">
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
      <button
        className="chat-conv-more absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-lg border-0 bg-transparent text-muted opacity-0 group-hover/bot:opacity-100 hover:bg-hover hover:text-ink focus-visible:opacity-100"
        type="button"
        aria-label={`${item.name} actions`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          props.onMenu(event, item);
        }}
      >
        <MoreIcon />
      </button>
    </div>
  );
});

const AppRow = memo(function AppRow(props: {
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
});

export function Chat(props: {
  botId: string;
  workspace: { id: string; name: string; slug: string };
  desk: OfficeSearch;
}) {
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
  const desk = officeSearch(props.desk);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "models">(
    "general",
  );
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [knowledgePath, setKnowledgePath] = useState<string | null>(null);
  const [hireOpen, setHireOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [narrow, setNarrow] = useState(
    () => window.matchMedia("(max-width: 720px)").matches,
  );
  const lastApp = useRef<{
    id: string;
    title: string;
    templateId: WorkspaceApp["templateId"];
  } | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [botMenu, setBotMenu] = useState<{
    bot: Bot;
    x: number;
    y: number;
    phase: BotMenuPhase;
  } | null>(null);
  const [theme, setTheme] = useState<Theme>(readTheme());
  const [pokeView, setPokeView] = useState<{
    threadId: string;
    peerName: string;
  } | null>(null);
  const stopThink = useRef<(() => void) | null>(null);
  const hiring = useRef(false);
  const [pokeMessages, setPokeMessages] = useState<ThreadMessage[]>([]);
  const [thinkKeepAlive, setThinkKeepAlive] = useState<string[]>(() =>
    props.botId ? [props.botId] : [],
  );
  const thinkLruRef = useRef<string[]>(props.botId ? [props.botId] : []);
  const bot = bots.find((item) => item.id === props.botId);
  const activeId = bot?.id;
  const mountedThinkIds = useMemo(() => {
    if (!activeId) return thinkKeepAlive;
    return rememberThinkKeepAlive(thinkKeepAlive, thinkLruRef.current, activeId)
      .mounted;
  }, [activeId, thinkKeepAlive]);
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
  const meta =
    metaQuery.data ?? (activeId ? readThreadMeta(activeId) : undefined);
  const hiringThis = Boolean(meta?.opening);
  const working = meta?.working ?? "";
  const error = meta?.error ?? "";
  const liveBots = useMemo(() => {
    return bots.filter((item) => !isArchivedBot(item)).sort(compareSidebarBots);
  }, [bots]);
  const archivedBots = useMemo(() => {
    return bots
      .filter((item) => isArchivedBot(item))
      .sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
      );
  }, [bots]);
  const showArchived = archivedOpen || Boolean(bot?.archivedAt);
  const workspaceApps = appsQuery.data ?? [];
  const openAppRow =
    desk.pane === "app" && desk.app
      ? workspaceApps.find((item) => item.id === desk.app)
      : undefined;
  if (openAppRow) {
    lastApp.current = {
      id: openAppRow.id,
      title: openAppRow.title,
      templateId: openAppRow.templateId,
    };
  }
  const openApp = openAppRow
    ? lastApp.current
    : desk.pane === "app"
      ? lastApp.current
      : null;

  const closeRoster = useCallback(() => setRosterOpen(false), []);
  const goToBot = useCallback(
    (botId: string, nextDesk: OfficeSearch = desk) => {
      setRosterOpen(false);
      return navigate({
        to: "/$workspaceSlug/bot/$botId",
        params: {
          workspaceSlug: props.workspace.slug,
          botId,
        },
        search: nextDesk,
      });
    },
    [desk, navigate, props.workspace.slug],
  );
  const setDesk = useCallback(
    (next: OfficeSearch) => goToBot(props.botId, next),
    [goToBot, props.botId],
  );

  useEffect(() => {
    if (bot?.archivedAt) setArchivedOpen(true);
  }, [bot?.archivedAt]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const onChange = () => {
      setNarrow(mq.matches);
      if (!mq.matches) setRosterOpen(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (narrow && !activeId) setRosterOpen(true);
  }, [activeId, narrow]);

  useEffect(() => {
    if (!rosterOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && bot) setRosterOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bot, rosterOpen]);

  useEffect(() => {
    if (!activeId) return;
    const next = rememberThinkKeepAlive(
      thinkKeepAlive,
      thinkLruRef.current,
      activeId,
    );
    thinkLruRef.current = next.lru;
    setThinkKeepAlive((prev) =>
      sameThinkKeepAlive(prev, next.mounted) ? prev : next.mounted,
    );
  }, [activeId, thinkKeepAlive]);

  useEffect(() => {
    const live = new Set(bots.map((item) => item.id));
    thinkLruRef.current = thinkLruRef.current.filter((id) => live.has(id));
    setThinkKeepAlive((prev) => {
      const next = prev.filter((id) => live.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [bots]);

  useEffect(() => {
    if (!me?.workspaceId) return;
    void appsCollection.utils.refetch();
  }, [me?.workspaceId]);

  async function refreshBots(selectId?: string) {
    await botsCollection.utils.refetch();
    const next = selectId ?? props.botId ?? firstLiveBot(peekBots())?.id;
    if (next && next !== props.botId) {
      await goToBot(next);
    }
  }

  const applyArchiveChange = useCallback(
    async (next: Bot) => {
      cacheBot(next);
      if (!next.archivedAt) {
        if (next.id !== props.botId) {
          await goToBot(next.id);
        }
        return;
      }
      const fallback =
        firstLiveBot(peekBots().filter((item) => item.id !== next.id)) ?? next;
      if (fallback.id !== props.botId) {
        await goToBot(fallback.id, deskClosed());
      }
    },
    [goToBot, props.botId],
  );

  const onNeedsModel = useCallback(() => {
    setSettingsTab("models");
    setSettingsOpen(true);
  }, []);

  const onUnarchiveBot = useCallback(
    (botId: string) => {
      void client.bots
        .unarchive({ botId })
        .then(applyArchiveChange)
        .catch((caught: unknown) =>
          patchThreadMeta(botId, {
            error: userFacingError(caught, "Could not unarchive"),
          }),
        );
    },
    [applyArchiveChange],
  );

  async function deleteTeammate(botId: string) {
    const snapshot = peekBots().find((item) => item.id === botId);
    if (!snapshot) return;
    const keepAlive = thinkKeepAlive;
    const lru = [...thinkLruRef.current];
    const currentId = props.botId;

    setThinkKeepAlive((prev) => dropThinkKeepAlive(prev, botId));
    thinkLruRef.current = dropThinkKeepAlive(thinkLruRef.current, botId);
    removeBot(botId);

    const nextId = nextBotIdAfterDelete(peekBots(), botId, currentId);
    const leave = !nextId
      ? navigate({ to: "/onboarding", search: {} })
      : nextId !== currentId
        ? goToBot(nextId, deskClosed())
        : undefined;

    try {
      await client.bots.delete({ botId });
      dropThreadMeta(botId);
      forgetThinkMessages(botId);
      void appsCollection.utils.refetch();
      await leave;
    } catch (caught: unknown) {
      await leave;
      cacheBot(snapshot);
      setThinkKeepAlive(keepAlive);
      thinkLruRef.current = lru;
      patchThreadMeta(botId, {
        error: userFacingError(caught, "Could not delete"),
      });
      if (currentId === botId) {
        await goToBot(botId, deskClosed());
      }
      throw caught;
    }
  }

  const openBotMenu = useCallback((event: MouseEvent, item: Bot) => {
    const box = botMenuBox("actions");
    setBotMenu({
      bot: item,
      phase: "actions",
      x: Math.min(event.clientX, window.innerWidth - box.width - 8),
      y: Math.min(event.clientY, window.innerHeight - box.height - 8),
    });
  }, []);

  async function togglePin(item: Bot) {
    const previous = item.pinnedAt;
    patchBot(item.id, {
      pinnedAt: previous ? null : new Date().toISOString(),
    });
    setBotMenu(null);
    try {
      const next = previous
        ? await client.bots.unpin({ botId: item.id })
        : await client.bots.pin({ botId: item.id });
      patchBot(item.id, { pinnedAt: next.pinnedAt });
    } catch (caught: unknown) {
      patchBot(item.id, { pinnedAt: previous });
      patchThreadMeta(item.id, {
        error: userFacingError(caught, "Could not pin"),
      });
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
        workspaceId: props.workspace.id,
        name: trimmed,
        avatarColor,
      });
      try {
        await cacheCreatedBot(draft);
        setThinkMessages(id, []);
        patchThreadMeta(id, { opening: true });
        void goToBot(id, deskClosed());
        const created = await client.bots.create({
          id,
          name: trimmed,
          avatarColor,
        });
        cacheBot(created);
        patchThreadMeta(id, { opening: false });
      } catch (caught) {
        removeBot(id);
        dropThreadMeta(id);
        const fallback = firstLiveBot(peekBots());
        if (fallback) {
          patchThreadMeta(fallback.id, {
            error: userFacingError(caught, "Could not create"),
          });
          if (fallback.id !== props.botId) {
            void goToBot(fallback.id, deskClosed());
          }
        }
      } finally {
        hiring.current = false;
      }
    },
    [goToBot, props.botId, props.workspace.id],
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const blocking =
    hireOpen || settingsOpen || pluginsOpen || knowledgeOpen || paletteOpen;
  const cycleBots = useCallback(
    (delta: 1 | -1) => {
      const nextId = neighborBotId(
        liveBots.map((item) => item.id),
        activeId,
        delta,
      );
      if (!nextId || nextId === activeId) return;
      void goToBot(nextId);
    },
    [liveBots, activeId, goToBot],
  );
  const runPaletteAction = useCallback(
    (id: PaletteActionId) => {
      setPaletteOpen(false);
      if (id === "hire") {
        if (!hiring.current) setHireOpen(true);
        return;
      }
      if (id === "plugins") {
        setPluginsOpen(true);
        return;
      }
      if (id === "knowledge") {
        setKnowledgePath(null);
        setKnowledgeOpen(true);
        return;
      }
      if (id === "workspace") {
        setSettingsTab("general");
        setSettingsOpen(true);
        return;
      }
      if (id === "settings") {
        setDesk(deskSettings());
        return;
      }
      setDesk(deskComputer());
    },
    [setDesk],
  );

  useHotkeys([
    {
      hotkey: "Mod+K",
      callback: () => {
        setPaletteOpen((open) => !open);
        setBotMenu(null);
      },
      options: {
        enabled:
          (!hireOpen && !settingsOpen && !pluginsOpen && !knowledgeOpen) ||
          paletteOpen,
      },
    },
    {
      hotkey: "Mod+N",
      callback: () => {
        setPaletteOpen(false);
        if (!hiring.current) setHireOpen(true);
      },
      options: { enabled: !settingsOpen && !pluginsOpen && !knowledgeOpen },
    },
    {
      hotkey: "Mod+,",
      callback: () => {
        setPaletteOpen(false);
        setSettingsTab("general");
        setSettingsOpen(true);
      },
      options: { enabled: !hireOpen },
    },
    {
      hotkey: "Escape",
      callback: () => setBotMenu(null),
      options: { enabled: Boolean(botMenu) && !paletteOpen },
    },
    {
      hotkey: "ArrowDown",
      callback: () => cycleBots(1),
      options: { enabled: !blocking },
    },
    {
      hotkey: "ArrowUp",
      callback: () => cycleBots(-1),
      options: { enabled: !blocking },
    },
  ]);

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
    (app: { appId: string }) => {
      setDesk(deskApp(app.appId));
    },
    [setDesk],
  );
  const [computerFile, setComputerFile] = useState<{
    botId: string;
    path: string;
  } | null>(null);
  const openComputerFile = useCallback(
    (path: string) => {
      setComputerFile({ botId: props.botId, path });
      setDesk(deskComputer());
    },
    [props.botId, setDesk],
  );
  const openKnowledgeFile = useCallback((path: string) => {
    setKnowledgePath(path);
    setKnowledgeOpen(true);
  }, []);
  const computerOpenPath =
    computerFile && computerFile.botId === props.botId
      ? computerFile.path
      : null;

  const paneMode = desk.pane ?? null;
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
    <ComputerFileOpenProvider onOpen={openComputerFile}>
      <KnowledgeFileOpenProvider onOpen={openKnowledgeFile}>
        <div
          className={cn(
            "chat-shell relative bg-bg",
            paneMode === "app" && "is-app",
            paneMode && paneMode !== "app" && "is-pane",
            rosterOpen && "is-roster",
          )}
        >
          <aside
            className="chat-side flex min-h-0 flex-col px-2.5 pb-2"
            aria-label="Teammates"
            inert={narrow && !rosterOpen ? true : undefined}
          >
            <div className="flex flex-col gap-2 px-0.5 pt-1.5 pb-2.5">
              <div className="side-chrome drag flex min-h-9 items-center gap-1">
                <div className="no-drag min-w-0 flex-1">
                  <WorkspaceSwitcher
                    name={props.workspace.name}
                    workspaceId={props.workspace.id}
                    workspaceSlug={props.workspace.slug}
                  />
                </div>
                <div className="no-drag relative flex shrink-0 items-center gap-0.5">
                  {bot ? (
                    <Button
                      className="hidden max-[720px]:grid"
                      variant="icon"
                      type="button"
                      aria-label="Close teammates"
                      onClick={closeRoster}
                    >
                      <CloseIcon />
                    </Button>
                  ) : null}
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
              <SearchTrigger
                onOpen={() => {
                  setBotMenu(null);
                  setPaletteOpen(true);
                }}
              />
            </div>
            <div className="grid flex-1 content-start gap-0.5 overflow-auto px-1">
              {liveBots.map((item) => (
                <BotRow
                  key={item.id}
                  item={item}
                  selected={item.id === bot?.id}
                  working={
                    item.id === bot?.id && (hiringThis || Boolean(working))
                  }
                  desk={desk}
                  workspaceSlug={props.workspace.slug}
                  onMenu={openBotMenu}
                  onPick={closeRoster}
                />
              ))}
              {liveBots.length === 0 && archivedBots.length === 0 ? (
                <p className="empty">No teammates yet.</p>
              ) : null}
              {workspaceApps.length > 0 ? (
                <div className="mt-2">
                  <div className="px-2 py-2 text-[12px] text-muted">Apps</div>
                  {workspaceApps.map((item) => (
                    <AppRow
                      key={item.id}
                      item={item}
                      selected={paneMode === "app" && openApp?.id === item.id}
                      onOpen={() => {
                        closeRoster();
                        setPokeView(null);
                        openDocument({ appId: item.id });
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
                          desk={desk}
                          workspaceSlug={props.workspace.slug}
                          onMenu={openBotMenu}
                          onPick={closeRoster}
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
                  setKnowledgePath(null);
                  setKnowledgeOpen(true);
                }}
              >
                <KnowledgeIcon />
                <span>Knowledge</span>
              </button>
              <button
                className="flex w-full items-center gap-2.5 rounded-xl border-0 bg-transparent px-2 py-2 text-left text-inherit hover:bg-hover"
                type="button"
                onClick={() => {
                  setSettingsTab("general");
                  setSettingsOpen(true);
                }}
              >
                <PersonAvatar name={me?.name || "You"} image={me?.image} />
                <span>{me?.name || "You"}</span>
              </button>
            </div>
          </aside>
          <div className="chat-stage">
            <section
              className="chat-thread flex min-h-0 min-w-0 flex-col bg-bg-thread"
              inert={narrow && rosterOpen ? true : undefined}
            >
              <div className="thread-head drag flex items-center justify-between gap-2 border-b border-line px-[18px] py-2.5">
                {pokeView ? (
                  <button
                    className="no-drag flex min-w-0 items-center gap-2.5 border-0 bg-transparent p-0 text-inherit"
                    type="button"
                    onClick={() => setPokeView(null)}
                  >
                    <ChevronLeftIcon />
                    <strong className="truncate text-[15px] font-semibold tracking-tight">
                      {bot?.name ?? "—"} · {pokeView.peerName}
                    </strong>
                  </button>
                ) : (
                  <div className="no-drag flex min-w-0 items-center gap-1">
                    <Button
                      className="chat-back hidden max-[720px]:grid"
                      variant="icon"
                      type="button"
                      aria-label="Teammates"
                      aria-expanded={rosterOpen}
                      onClick={() => setRosterOpen(true)}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <button
                      className="flex min-w-0 items-center gap-2.5 border-0 bg-transparent p-0 text-inherit"
                      type="button"
                      onClick={() => {
                        setDesk(deskSettings());
                      }}
                    >
                      {bot ? (
                        <AvatarMark
                          name={bot.name}
                          color={bot.avatarColor}
                          shape={bot.avatarShape}
                          mood={hiringThis || working ? "working" : "idle"}
                          size="sm"
                          hero
                        />
                      ) : null}
                      <strong className="truncate text-[15px] font-semibold tracking-tight">
                        {bot?.name ?? "—"}
                      </strong>
                    </button>
                  </div>
                )}
                <div className="no-drag flex shrink-0 items-center gap-1.5">
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
                          if (desk.pane === "computer") setComputerFile(null);
                          setDesk(toggleDesk(desk, "computer"));
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
                          setDesk(toggleDesk(desk, "settings"));
                        }}
                      >
                        <GearIcon />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              {me?.needsModel || me?.modelWarning ? (
                <div className="mx-5 mb-2 flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-[13px] max-[720px]:mx-3">
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
                      {bot?.name} and {pokeView.peerName} talking. Back to stay
                      with {bot?.name}.
                    </p>
                  </div>
                </>
              ) : bot ? (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {mountedThinkIds.map((id) => {
                    const item = bots.find((row) => row.id === id);
                    if (!item) return null;
                    const isActive = item.id === bot.id;
                    const itemMeta = isActive ? meta : readThreadMeta(item.id);
                    const itemOpening = Boolean(itemMeta?.opening);
                    const itemError = isActive
                      ? error
                      : (itemMeta?.error ?? "");
                    return (
                      <KeptThinkThread
                        key={item.id}
                        botId={item.id}
                        botName={item.name}
                        active={isActive}
                        archived={Boolean(item.archivedAt)}
                        needsModel={Boolean(me?.needsModel)}
                        userId={me?.userId}
                        userName={me?.name}
                        userImage={me?.image ?? undefined}
                        opening={itemOpening}
                        placeholder={
                          me?.needsModel
                            ? "Add a model key to send"
                            : `Message ${item.name}`
                        }
                        error={itemError}
                        onNeedsModel={onNeedsModel}
                        onUnarchive={onUnarchiveBot}
                        stopRef={stopThink}
                      />
                    );
                  })}
                </div>
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
                  onCollapse={() => setDesk(deskClosed())}
                />
              ) : null}
              {pane.rendered === "settings" && bot ? (
                <BotSettingsPane
                  key={bot.id}
                  bot={bot}
                  pending={hiringThis}
                  onCollapse={() => setDesk(deskClosed())}
                  onSaved={async () => {
                    await refreshBots(bot.id);
                  }}
                  onArchiveChange={applyArchiveChange}
                  onDeleted={async (bot) => {
                    await deleteTeammate(bot.id);
                  }}
                />
              ) : null}
              {pane.rendered === "computer" && bot ? (
                <ComputerPane
                  key={bot.id}
                  bot={bot}
                  openPath={computerOpenPath}
                  onPreviewClose={() => setComputerFile(null)}
                  onSettings={() => {
                    setComputerFile(null);
                    setDesk(deskSettings());
                  }}
                  onCollapse={() => {
                    setComputerFile(null);
                    setDesk(deskClosed());
                  }}
                />
              ) : null}
            </div>
          </div>
          {pluginsOpen ? (
            <PluginsModal
              open
              botId={activeId}
              onClose={() => setPluginsOpen(false)}
            />
          ) : null}
          {knowledgeOpen ? (
            <KnowledgeModal
              open
              initialPath={knowledgePath}
              onClose={() => {
                setKnowledgeOpen(false);
                setKnowledgePath(null);
              }}
            />
          ) : null}
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
          <CommandPalette
            open={paletteOpen}
            bots={[...liveBots, ...archivedBots]}
            apps={workspaceApps}
            onClose={() => setPaletteOpen(false)}
            onBot={(botId) => {
              setPaletteOpen(false);
              setPokeView(null);
              void goToBot(botId);
            }}
            onApp={(appId) => {
              setPaletteOpen(false);
              setPokeView(null);
              openDocument({ appId });
            }}
            onAction={runPaletteAction}
          />
          <HireDialog
            open={hireOpen}
            onClose={() => setHireOpen(false)}
            onHire={(name) => void hire(name)}
          />
          {botMenu ? (
            <>
              <button
                className="fixed inset-0 z-30 cursor-default border-0 bg-transparent"
                type="button"
                aria-label="Close bot menu"
                onClick={() => setBotMenu(null)}
              />
              <div
                className="menu"
                role="menu"
                style={{
                  position: "fixed",
                  left: botMenu.x,
                  top: botMenu.y,
                  right: "auto",
                  zIndex: 31,
                }}
              >
                {botMenuItems({
                  pinned: isPinnedBot(botMenu.bot),
                  name: botMenu.bot.name,
                  phase: botMenu.phase,
                }).flatMap((item, index) => {
                  const nodes = [];
                  if (
                    item.id === "delete" &&
                    botMenu.phase === "actions" &&
                    index > 0
                  ) {
                    nodes.push(<div key="sep" className="menu-sep" />);
                  }
                  nodes.push(
                    <button
                      key={item.id}
                      className={item.id === "delete" ? "danger" : undefined}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (item.id === "pin") {
                          void togglePin(botMenu.bot);
                          return;
                        }
                        if (item.id === "cancel-delete") {
                          setBotMenu({ ...botMenu, phase: "actions" });
                          return;
                        }
                        if (botMenu.phase === "actions") {
                          const box = botMenuBox("confirm-delete");
                          setBotMenu({
                            ...botMenu,
                            phase: "confirm-delete",
                            x: Math.min(
                              botMenu.x,
                              window.innerWidth - box.width - 8,
                            ),
                            y: Math.min(
                              botMenu.y,
                              window.innerHeight - box.height - 8,
                            ),
                          });
                          return;
                        }
                        setBotMenu(null);
                        void deleteTeammate(botMenu.bot.id);
                      }}
                    >
                      {item.id === "pin" ? <PinIcon /> : null}
                      {item.id === "delete" ? <TrashIcon /> : null}
                      <span className="min-w-0 truncate">{item.label}</span>
                    </button>,
                  );
                  return nodes;
                })}
              </div>
            </>
          ) : null}
        </div>
      </KnowledgeFileOpenProvider>
    </ComputerFileOpenProvider>
  );
}
