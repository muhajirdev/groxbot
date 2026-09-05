import type {
  Bot,
  ProductEvent,
  Room,
  SidebarSection,
  ThreadMessage,
  WorkspaceApp,
} from "@groxbot/contracts";
import { eq, useLiveQuery } from "@tanstack/react-db";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  type CSSProperties,
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
import { AvatarMark, MemberStack } from "../components/Avatar";
import { BotSettingsPane } from "../components/BotSettingsPane";
import { BotContextMenu } from "../components/BotContextMenu";
import {
  ConfirmRoomDeleteDialog,
  RoomContextMenu,
} from "../components/RoomContextMenu";
import { SectionContextMenu } from "../components/SectionContextMenu";
import {
  ComputerFileOpenProvider,
  KnowledgeFileOpenProvider,
} from "../components/ChatFileLink";
import { CommandPalette, SearchTrigger } from "../components/CommandPalette";
import { ComputerPane } from "../components/ComputerPane";
import { CreateRoomDialog } from "../components/CreateRoomDialog";
import { HireMarketplaceModal } from "../components/HireMarketplaceModal";
import {
  CaretSwapIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CloseIcon,
  FileIcon,
  GearIcon,
  KnowledgeIcon,
  LiveAppsIcon,
  MonitorIcon,
  MoreIcon,
  PinIcon,
  PlugIcon,
  SkillsIcon,
} from "../components/Icons";
import { SectionDialog } from "../components/SectionDialog";
import { SidebarCreateMenu } from "../components/SidebarCreateMenu";
import { KnowledgeLibrary, KnowledgePeek } from "../components/KnowledgePlace";
import { KeptOfficeThread } from "../components/OfficeThread";
import { PersonAvatar } from "../components/PersonAvatar";
import { PluginsModal } from "../components/PluginsModal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { KeptRoomThread } from "../components/RoomThread";
import { ThreadList } from "../components/ThreadList";
import { WorkspaceSwitcher } from "../components/WorkspaceSwitcher";
import { APP_KIND_COLOR, APP_KIND_LABEL } from "../lib/app-kind";
import { authClient } from "../lib/auth";
import {
  appsCollection,
  botsCollection,
  clearThreadStore,
  patchBot,
  patchSection,
  peekBots,
  peekRooms,
  peekSections,
  removeBot,
  removeRoom,
  removeSection,
  roomsCollection,
  sectionsCollection,
  threadMetaCollection,
  upsertRoom,
  upsertSection,
} from "../lib/collections";
import {
  neighborBotId,
  ROSTER_NEXT_HOTKEY,
  ROSTER_PREV_HOTKEY,
  type PaletteActionId,
} from "../lib/command-palette";
import { saveComputerDownload } from "../lib/computer-download";
import { userFacingError } from "../lib/errors";
import { draftCreatedBot, nextAvatarColor } from "../lib/hire";
import {
  dropOfficeKeepAlive,
  rememberOfficeKeepAlive,
  sameOfficeKeepAlive,
} from "../lib/office-keepalive";
import {
  forgetOfficeMessages,
  setOfficeMessages,
} from "../lib/office-messages";
import { forgetRoomMessages } from "../lib/room-messages";
import { OFFICE_TO, ROOM_TO, officeKnowledgeHref } from "../lib/office-route";
import {
  closeLibrary,
  closePeek,
  deskApp,
  deskAwayFromLibrary,
  deskClosed,
  deskComputer,
  deskLibrary,
  deskPeek,
  deskSettings,
  libraryShowsSkills,
  type OfficeSearch,
  officeSearch,
  roomDeskSearch,
  SKILLS_LIBRARY_PATH,
  toggleDesk,
} from "../lib/office-search";
import { orpc } from "../lib/orpc";
import { usePanePresence } from "../lib/presence";
import {
  readCollapsedSections,
  writeCollapsedSections,
} from "../lib/prefs";
import { client } from "../lib/rpc";
import {
  SIDE_WIDTH_MAX,
  SIDE_WIDTH_MIN,
  useSideWidth,
} from "../lib/side-width";
import {
  PANE_WIDTH_MAX,
  PANE_WIDTH_MIN,
  usePaneWidth,
} from "../lib/pane-width";
import {
  cacheBot,
  cacheCreatedBot,
  firstLiveBot,
  isArchivedBot,
  officeProfileLabel,
} from "../lib/session";
import { knowledgeListQueryOptions } from "../lib/workspace-catalog";
import { writeLastRoom } from "../lib/workspace-switcher";
import {
  type BotMenuPhase,
  botMenuBox,
  botMenuItems,
  compareSidebarBots,
  groupSidebarBots,
  isPinnedBot,
  mixSidebarLive,
  type RoomMenuPhase,
  roomMenuBox,
  nextBotIdAfterDelete,
  roomSidebarFaces,
  type SectionMenuPhase,
  sectionMenuBox,
  sectionMenuItems,
} from "../lib/sidebar";
import { applyTheme, readTheme, type Theme } from "../lib/theme";
import {
  dropThreadMeta,
  ensureThreadMeta,
  OFFICE_WORKING,
  patchThreadMeta,
  readCursor,
  readThreadMeta,
} from "../lib/thread-cache";
import { scheduleKnowledgeFilePrefetch } from "../lib/file-cache";
import { scheduleThreadPrefetch } from "../lib/thread-prefetch";
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
        to="/$workspaceSlug/room/$roomId"
        params={{
          workspaceSlug: props.workspaceSlug,
          roomId: item.homeRoomId || item.id,
        }}
        search={deskAwayFromLibrary(props.desk)}
        preload="intent"
        preloadDelay={300}
        className={cn(
          "chat-conv grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-2 rounded-[10px] border-0 bg-transparent px-1.5 py-1.5 text-left text-inherit no-underline",
          props.selected && "bg-selected",
          props.muted && "opacity-70",
        )}
        aria-label={
          item.visibility === "private"
            ? pinned
              ? `${item.name}, private, pinned`
              : `${item.name}, private`
            : pinned
              ? `${item.name}, pinned`
              : item.name
        }
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
            size="sm"
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
              <span className="truncate text-[13px] font-semibold">
                {item.name}
              </span>
              {item.visibility === "private" ? (
                <span className="shrink-0 text-[11px] font-normal text-muted">
                  Private
                </span>
              ) : null}
              {pinned ? (
                <PinIcon className="size-3 shrink-0 text-muted" weight="fill" />
              ) : null}
            </span>
            <span className="chat-conv-time shrink-0 text-[11px] whitespace-nowrap text-muted group-hover/bot:invisible">
              {formatListTime(item.lastAt)}
            </span>
          </span>
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

const RoomRow = memo(function RoomRow(props: {
  item: Room;
  selected: boolean;
  desk: OfficeSearch;
  workspaceSlug: string;
  onMenu: (event: MouseEvent, room: Room) => void;
  onPick?: () => void;
}) {
  const item = props.item;
  return (
    <div className="group/room relative">
      <Link
        to={ROOM_TO}
        params={{
          workspaceSlug: props.workspaceSlug,
          roomId: item.id,
        }}
        search={deskAwayFromLibrary(props.desk)}
        preload="intent"
        preloadDelay={300}
        onClick={props.onPick}
        onContextMenu={(event) => {
          event.preventDefault();
          props.onMenu(event, item);
        }}
        aria-label={item.name}
        className={cn(
          "chat-conv grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-2 rounded-[10px] border-0 bg-transparent px-1.5 py-1.5 text-left text-inherit no-underline",
          props.selected && "bg-selected",
        )}
      >
        <MemberStack faces={roomSidebarFaces(item.members)} />
        <span className="chat-conv-copy min-w-0">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold">{item.name}</span>
            <span className="chat-conv-time shrink-0 text-[11px] whitespace-nowrap text-muted group-hover/room:invisible">
              {formatListTime(item.lastAt)}
            </span>
          </span>
        </span>
      </Link>
      <button
        className="chat-conv-more absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-lg border-0 bg-transparent text-muted opacity-0 group-hover/room:opacity-100 hover:bg-hover hover:text-ink focus-visible:opacity-100"
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
        "chat-conv grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-2 rounded-[10px] border-0 bg-transparent px-1.5 py-1.5 text-left text-inherit",
        props.selected && "bg-selected",
      )}
      onClick={props.onOpen}
    >
      <span
        className="grid size-7 shrink-0 place-items-center rounded-[8px] text-white"
        style={{ background: APP_KIND_COLOR[item.templateId] }}
      >
        <FileIcon />
      </span>
      <span className="chat-conv-copy min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-semibold">{item.title}</span>
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

const SectionHeader = memo(function SectionHeader(props: {
  name: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onMenu: (event: MouseEvent) => void;
}) {
  return (
    <div className="group/section relative">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded-[10px] border-0 bg-transparent px-1.5 py-1 text-left text-[11px] text-muted hover:bg-hover"
        aria-expanded={!props.collapsed}
        onClick={props.onToggle}
        onContextMenu={(event) => {
          event.preventDefault();
          props.onMenu(event);
        }}
      >
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 transition-transform",
            props.collapsed && "-rotate-90",
          )}
        />
        <span className="min-w-0 flex-1 truncate font-medium tracking-wide uppercase">
          {props.name}
        </span>
        <span className="shrink-0 group-hover/section:invisible">
          {props.count}
        </span>
      </button>
      <button
        className="absolute top-0.5 right-0.5 grid size-7 place-items-center rounded-lg border-0 bg-transparent text-muted opacity-0 group-hover/section:opacity-100 hover:bg-hover hover:text-ink focus-visible:opacity-100"
        type="button"
        aria-label={`${props.name} actions`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          props.onMenu(event);
        }}
      >
        <MoreIcon />
      </button>
    </div>
  );
});

export function Chat(props: {
  botId?: string;
  roomId?: string;
  workspace: { id: string; name: string; slug: string };
  desk: OfficeSearch;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const botsQuery = useLiveQuery((q) => q.from({ bot: botsCollection }));
  const roomsQuery = useLiveQuery((q) => q.from({ room: roomsCollection }));
  const sectionsQuery = useLiveQuery((q) =>
    q.from({ section: sectionsCollection }),
  );
  const appsQuery = useLiveQuery((q) => q.from({ app: appsCollection }));
  const meQuery = useQuery(orpc.me.queryOptions());
  const liveBotsRows = botsQuery.data ?? [];
  const peekedBots = peekBots();
  const bots =
    liveBotsRows.length > 0 || peekedBots.length === 0
      ? liveBotsRows
      : peekedBots;
  const liveRoomsRows = roomsQuery.data ?? [];
  const peekedRooms = peekRooms();
  const rooms =
    liveRoomsRows.length > 0 || peekedRooms.length === 0
      ? liveRoomsRows
      : peekedRooms;
  const liveSectionRows = sectionsQuery.data ?? [];
  const peekedSections = peekSections();
  const sections =
    liveSectionRows.length > 0 || peekedSections.length === 0
      ? liveSectionRows
      : peekedSections;
  const me = meQuery.data;
  const desk = officeSearch(props.desk);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const knowledgeListQuery = useQuery(knowledgeListQueryOptions());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "models">(
    "general",
  );
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [roomDelete, setRoomDelete] = useState<Room | null>(null);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionRename, setSectionRename] = useState<SidebarSection | null>(
    null,
  );
  const [rosterOpen, setRosterOpen] = useState(false);
  const [narrow, setNarrow] = useState(
    () => window.matchMedia("(max-width: 720px)").matches,
  );
  const side = useSideWidth();
  const paneCol = usePaneWidth();
  const lastApp = useRef<{
    id: string;
    title: string;
    templateId: WorkspaceApp["templateId"];
  } | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState(
    () => new Set(readCollapsedSections(props.workspace.id)),
  );
  const [botMenu, setBotMenu] = useState<{
    bot: Bot;
    x: number;
    y: number;
    phase: BotMenuPhase;
  } | null>(null);
  const [roomMenu, setRoomMenu] = useState<{
    room: Room;
    x: number;
    y: number;
    phase: RoomMenuPhase;
  } | null>(null);
  const [sectionMenu, setSectionMenu] = useState<{
    section: SidebarSection;
    memberCount: number;
    x: number;
    y: number;
    phase: SectionMenuPhase;
  } | null>(null);
  const [theme, setTheme] = useState<Theme>(readTheme());
  const [pokeView, setPokeView] = useState<{
    threadId: string;
    peerName: string;
  } | null>(null);
  const stopOffice = useRef<(() => void) | null>(null);
  const hiring = useRef(false);
  const [pokeMessages, setPokeMessages] = useState<ThreadMessage[]>([]);
  const [officeKeepAlive, setOfficeKeepAlive] = useState<string[]>(() =>
    props.botId ? [props.botId] : [],
  );
  const officeLruRef = useRef<string[]>(props.botId ? [props.botId] : []);
  const [roomKeepAlive, setRoomKeepAlive] = useState<string[]>(() =>
    props.roomId ? [props.roomId] : [],
  );
  const roomLruRef = useRef<string[]>(props.roomId ? [props.roomId] : []);
  const homeBot = bots.find(
    (item) =>
      (props.roomId && item.homeRoomId === props.roomId) ||
      (!props.roomId && item.id === props.botId),
  );
  const isRoom = Boolean(props.roomId && !homeBot);
  const room = rooms.find((item: Room) => item.id === props.roomId);
  const focusedBotId =
    desk.bot ||
    homeBot?.id ||
    room?.members.find((member) => !member.archivedAt)?.botId ||
    room?.members[0]?.botId ||
    props.botId;
  const bot = homeBot || bots.find((item) => item.id === focusedBotId);
  const currentBotId = homeBot?.id;
  const activeId = isRoom ? props.roomId : bot?.id;
  const mountedOfficeIds = useMemo(() => {
    if (isRoom || !bot?.id) return officeKeepAlive;
    return rememberOfficeKeepAlive(
      officeKeepAlive,
      officeLruRef.current,
      bot.id,
    ).mounted;
  }, [bot?.id, isRoom, officeKeepAlive]);
  const mountedRoomIds = useMemo(() => {
    if (!props.roomId) return roomKeepAlive;
    return rememberOfficeKeepAlive(
      roomKeepAlive,
      roomLruRef.current,
      props.roomId,
    ).mounted;
  }, [props.roomId, roomKeepAlive]);
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
  const groupedBots = useMemo(
    () => groupSidebarBots(liveBots, sections),
    [liveBots, sections],
  );
  const ungroupedLive = useMemo(
    () => mixSidebarLive(groupedBots.ungrouped, rooms),
    [groupedBots.ungrouped, rooms],
  );
  const prefetchKey = useMemo(
    () =>
      [
        ...liveBots.map((item) => item.homeRoomId || item.id),
        ...rooms.map((item) => item.id),
      ].join(","),
    [liveBots, rooms],
  );
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
      const bot = peekBots().find((item) => item.id === botId);
      return navigate({
        to: OFFICE_TO,
        params: {
          workspaceSlug: props.workspace.slug,
          roomId: bot?.homeRoomId || botId,
        },
        search: nextDesk,
      });
    },
    [desk, navigate, props.workspace.slug],
  );
  const goToRoom = useCallback(
    (roomId: string, nextDesk: OfficeSearch = desk) => {
      setRosterOpen(false);
      return navigate({
        to: ROOM_TO,
        params: {
          workspaceSlug: props.workspace.slug,
          roomId,
        },
        search: nextDesk,
      });
    },
    [desk, navigate, props.workspace.slug],
  );
  const setDesk = useCallback(
    (next: OfficeSearch) => {
      if (props.roomId) {
        return goToRoom(props.roomId, roomDeskSearch(next, focusedBotId));
      }
      if (props.botId) return goToBot(props.botId, next);
    },
    [focusedBotId, goToBot, goToRoom, props.botId, props.roomId],
  );

  useEffect(() => {
    if (bot?.archivedAt) setArchivedOpen(true);
  }, [bot?.archivedAt]);

  useEffect(() => {
    setCollapsedIds(new Set(readCollapsedSections(props.workspace.id)));
  }, [props.workspace.id]);

  useEffect(() => {
    if (props.roomId) writeLastRoom(props.workspace.id, props.roomId);
  }, [props.workspace.id, props.roomId]);

  useEffect(() => {
    if (!sectionsCollection.isReady()) void sectionsCollection.preload();
  }, []);

  useEffect(() => {
    const sectionId = bot?.sectionId;
    if (!sectionId || bot?.archivedAt) return;
    setCollapsedIds((prev) => {
      if (!prev.has(sectionId)) return prev;
      const next = new Set(prev);
      next.delete(sectionId);
      writeCollapsedSections(props.workspace.id, [...next]);
      return next;
    });
  }, [bot?.archivedAt, bot?.sectionId, props.workspace.id]);

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
    const skip = [
      homeBot?.homeRoomId || homeBot?.id || "",
      isRoom ? props.roomId || "" : "",
    ];
    return scheduleThreadPrefetch({
      bots: liveBots,
      rooms,
      skipRoomIds: skip,
    });
  }, [
    homeBot?.homeRoomId,
    homeBot?.id,
    isRoom,
    liveBots,
    prefetchKey,
    props.roomId,
    rooms,
  ]);

  useEffect(() => {
    return scheduleKnowledgeFilePrefetch(queryClient, {
      entries: knowledgeListQuery.data?.entries ?? [],
      prefer: desk.knowledge,
    });
  }, [desk.knowledge, knowledgeListQuery.data, queryClient]);

  useEffect(() => {
    if (!rosterOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && bot) setRosterOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bot, rosterOpen]);

  useEffect(() => {
    if (isRoom || !bot?.id) return;
    const next = rememberOfficeKeepAlive(
      officeKeepAlive,
      officeLruRef.current,
      bot.id,
    );
    officeLruRef.current = next.lru;
    setOfficeKeepAlive((prev) =>
      sameOfficeKeepAlive(prev, next.mounted) ? prev : next.mounted,
    );
  }, [bot?.id, isRoom, officeKeepAlive]);

  useEffect(() => {
    if (!props.roomId) return;
    const next = rememberOfficeKeepAlive(
      roomKeepAlive,
      roomLruRef.current,
      props.roomId,
    );
    roomLruRef.current = next.lru;
    setRoomKeepAlive((prev) =>
      sameOfficeKeepAlive(prev, next.mounted) ? prev : next.mounted,
    );
  }, [props.roomId, roomKeepAlive]);

  useEffect(() => {
    const live = new Set(bots.map((item) => item.id));
    officeLruRef.current = officeLruRef.current.filter((id) => live.has(id));
    setOfficeKeepAlive((prev) => {
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
    const next = selectId ?? currentBotId ?? firstLiveBot(peekBots())?.id;
    if (next && next !== currentBotId) {
      await goToBot(next);
    }
  }

  const applyArchiveChange = useCallback(
    async (next: Bot) => {
      cacheBot(next);
      if (!next.archivedAt) {
        if (next.id !== currentBotId) {
          await goToBot(next.id);
        }
        return;
      }
      const fallback =
        firstLiveBot(peekBots().filter((item) => item.id !== next.id)) ?? next;
      if (fallback.id !== currentBotId) {
        await goToBot(fallback.id, deskClosed());
      }
    },
    [currentBotId, goToBot],
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
    const keepAlive = officeKeepAlive;
    const lru = [...officeLruRef.current];
    const currentId = currentBotId;

    setOfficeKeepAlive((prev) => dropOfficeKeepAlive(prev, botId));
    officeLruRef.current = dropOfficeKeepAlive(officeLruRef.current, botId);
    removeBot(botId);

    const nextId = currentId
      ? nextBotIdAfterDelete(peekBots(), botId, currentId)
      : null;
    const leave = !currentId
      ? undefined
      : !nextId
        ? navigate({ to: "/onboarding", search: {} })
        : nextId !== currentId
          ? goToBot(nextId, deskClosed())
          : undefined;

    try {
      await client.bots.delete({ botId });
      dropThreadMeta(botId);
      forgetOfficeMessages(snapshot.homeRoomId || botId);
      void appsCollection.utils.refetch();
      await leave;
    } catch (caught: unknown) {
      await leave;
      cacheBot(snapshot);
      setOfficeKeepAlive(keepAlive);
      officeLruRef.current = lru;
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
    const items = botMenuItems({
      pinned: isPinnedBot(item),
      archived: Boolean(item.archivedAt),
      name: item.name,
      phase: "actions",
      sections,
      owner: Boolean(me?.userId && item.userId === me.userId),
      visibility: item.visibility,
    });
    const box = botMenuBox("actions", items.length);
    setSectionMenu(null);
    setRoomMenu(null);
    setBotMenu({
      bot: item,
      phase: "actions",
      x: Math.min(event.clientX, window.innerWidth - box.width - 8),
      y: Math.min(event.clientY, window.innerHeight - box.height - 8),
    });
  }, [me?.userId, sections]);

  const openRoomMenu = useCallback((event: MouseEvent, item: Room) => {
    const box = roomMenuBox("actions");
    setBotMenu(null);
    setSectionMenu(null);
    setRoomMenu({
      room: item,
      phase: "actions",
      x: Math.min(event.clientX, window.innerWidth - box.width - 8),
      y: Math.min(event.clientY, window.innerHeight - box.height - 8),
    });
  }, []);

  async function deleteRoom(room: Room) {
    const snapshot = peekRooms().find((item) => item.id === room.id) ?? room;
    const keepAlive = roomKeepAlive;
    const lru = [...roomLruRef.current];
    const viewing = props.roomId === room.id;

    setRoomKeepAlive((prev) => dropOfficeKeepAlive(prev, room.id));
    roomLruRef.current = dropOfficeKeepAlive(roomLruRef.current, room.id);
    removeRoom(room.id);

    const nextRoom = peekRooms()[0];
    const nextBot = firstLiveBot(peekBots());
    const leave = !viewing
      ? undefined
      : nextRoom
        ? goToRoom(nextRoom.id, deskClosed())
        : nextBot
          ? goToBot(nextBot.id, deskClosed())
          : navigate({ to: "/onboarding", search: {} });

    try {
      await client.rooms.delete({ roomId: room.id });
      dropThreadMeta(room.id);
      forgetRoomMessages(room.id);
      await leave;
    } catch (caught: unknown) {
      await leave;
      upsertRoom(snapshot);
      setRoomKeepAlive(keepAlive);
      roomLruRef.current = lru;
      patchThreadMeta(room.id, {
        error: userFacingError(caught, "Could not delete room"),
      });
      if (viewing) {
        await goToRoom(room.id, deskClosed());
      }
      throw caught;
    }
  }

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

  async function toggleArchive(item: Bot) {
    const previous = item.archivedAt;
    patchBot(item.id, {
      archivedAt: previous ? null : new Date().toISOString(),
    });
    setBotMenu(null);
    try {
      const next = previous
        ? await client.bots.unarchive({ botId: item.id })
        : await client.bots.archive({ botId: item.id });
      await applyArchiveChange(next);
    } catch (caught: unknown) {
      patchBot(item.id, { archivedAt: previous });
      patchThreadMeta(item.id, {
        error: userFacingError(
          caught,
          previous ? "Could not unarchive" : "Could not archive",
        ),
      });
    }
  }

  async function toggleShare(item: Bot) {
    const previous = item.visibility;
    const visibility = previous === "shared" ? "private" : "shared";
    patchBot(item.id, { visibility });
    setBotMenu(null);
    try {
      const next = await client.bots.update({ botId: item.id, visibility });
      patchBot(item.id, { visibility: next.visibility });
    } catch (caught: unknown) {
      patchBot(item.id, { visibility: previous });
      patchThreadMeta(item.id, {
        error: userFacingError(
          caught,
          visibility === "shared" ? "Could not share" : "Could not make private",
        ),
      });
    }
  }

  const hire = useCallback(
    async (input: {
      name: string;
      visibility: "private" | "shared";
      title?: string;
      marketplaceId?: string;
      instructions?: string;
      description?: string;
    }) => {
      const trimmed = input.name.trim();
      if (!trimmed || hiring.current) return;
      hiring.current = true;
      setHireOpen(false);
      const id = crypto.randomUUID();
      const homeRoomId = crypto.randomUUID();
      const roster = peekBots();
      const avatarColor = nextAvatarColor(roster);
      const title = input.title?.trim() || undefined;
      const draft = draftCreatedBot({
        id,
        homeRoomId,
        workspaceId: props.workspace.id,
        name: trimmed,
        avatarColor,
        userId: me?.userId,
        visibility: input.visibility,
        ...(title ? { title } : {}),
      });
      try {
        await cacheCreatedBot(draft);
        setOfficeMessages(homeRoomId, []);
        patchThreadMeta(id, { opening: true, working: OFFICE_WORKING });
        void goToBot(id, deskClosed());
        const created = await client.bots.create({
          id,
          homeRoomId,
          name: trimmed,
          avatarColor,
          visibility: input.visibility,
          ...(title ? { title } : {}),
          ...(input.marketplaceId
            ? { marketplaceId: input.marketplaceId }
            : {}),
          ...(input.instructions
            ? { instructions: input.instructions }
            : {}),
          ...(input.description ? { description: input.description } : {}),
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
          if (fallback.id !== currentBotId) {
            void goToBot(fallback.id, deskClosed());
          }
        }
      } finally {
        hiring.current = false;
      }
    },
    [currentBotId, goToBot, me?.userId, props.workspace.id],
  );

  const createRoom = useCallback(
    async (input: { name: string; memberBotIds: string[] }) => {
      setRoomOpen(false);
      try {
        const created = await client.rooms.create(input);
        upsertRoom(created);
        void goToRoom(created.id, deskClosed());
      } catch (caught) {
        if (activeId) {
          patchThreadMeta(activeId, {
            error: userFacingError(caught, "Could not create room"),
          });
        }
      }
    },
    [activeId, goToRoom],
  );

  const createSection = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setSectionOpen(false);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const position =
        sections.reduce((top, row) => Math.max(top, row.position), -1) + 1;
      const draft: SidebarSection = {
        id,
        workspaceId: props.workspace.id,
        name: trimmed,
        position,
        createdAt: now,
        updatedAt: now,
      };
      if (!sectionsCollection.isReady()) await sectionsCollection.preload();
      upsertSection(draft);
      try {
        const created = await client.sections.create({ id, name: trimmed });
        upsertSection(created);
      } catch (caught) {
        removeSection(id);
        if (activeId) {
          patchThreadMeta(activeId, {
            error: userFacingError(caught, "Could not create section"),
          });
        }
      }
    },
    [activeId, props.workspace.id, sections],
  );

  const renameSection = useCallback(
    async (section: SidebarSection, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setSectionRename(null);
      const previous = section.name;
      patchSection(section.id, { name: trimmed });
      try {
        const next = await client.sections.rename({
          sectionId: section.id,
          name: trimmed,
        });
        upsertSection(next);
      } catch (caught) {
        patchSection(section.id, { name: previous });
        if (activeId) {
          patchThreadMeta(activeId, {
            error: userFacingError(caught, "Could not rename section"),
          });
        }
      }
    },
    [activeId],
  );

  const deleteSection = useCallback(
    async (section: SidebarSection) => {
      const snapshot = peekSections().find((row) => row.id === section.id);
      const members = peekBots().filter((item) => item.sectionId === section.id);
      removeSection(section.id);
      for (const member of members) {
        patchBot(member.id, { sectionId: null });
      }
      try {
        await client.sections.remove({ sectionId: section.id });
      } catch (caught) {
        if (snapshot) upsertSection(snapshot);
        for (const member of members) {
          patchBot(member.id, { sectionId: section.id });
        }
        if (activeId) {
          patchThreadMeta(activeId, {
            error: userFacingError(caught, "Could not delete section"),
          });
        }
      }
    },
    [activeId],
  );

  const moveBotToSection = useCallback(
    async (item: Bot, sectionId: string | null) => {
      const previous = item.sectionId;
      patchBot(item.id, { sectionId });
      if (sectionId) {
        setCollapsedIds((prev) => {
          if (!prev.has(sectionId)) return prev;
          const next = new Set(prev);
          next.delete(sectionId);
          writeCollapsedSections(props.workspace.id, [...next]);
          return next;
        });
      }
      setBotMenu(null);
      try {
        const next = await client.bots.move({ botId: item.id, sectionId });
        patchBot(item.id, { sectionId: next.sectionId });
      } catch (caught) {
        patchBot(item.id, { sectionId: previous });
        patchThreadMeta(item.id, {
          error: userFacingError(caught, "Could not move"),
        });
      }
    },
    [props.workspace.id],
  );

  const toggleSectionCollapsed = useCallback(
    (sectionId: string) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(sectionId)) next.delete(sectionId);
        else next.add(sectionId);
        writeCollapsedSections(props.workspace.id, [...next]);
        return next;
      });
    },
    [props.workspace.id],
  );

  const openSectionMenu = useCallback(
    (event: MouseEvent, section: SidebarSection, memberCount: number) => {
      const box = sectionMenuBox("actions");
      setBotMenu(null);
      setRoomMenu(null);
      setSectionMenu({
        section,
        memberCount,
        phase: "actions",
        x: Math.min(event.clientX, window.innerWidth - box.width - 8),
        y: Math.min(event.clientY, window.innerHeight - box.height - 8),
      });
    },
    [],
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const blocking =
    hireOpen ||
    roomOpen ||
    sectionOpen ||
    Boolean(sectionRename) ||
    settingsOpen ||
    pluginsOpen ||
    paletteOpen ||
    Boolean(roomDelete);
  const cycleBots = useCallback(
    (delta: 1 | -1) => {
      const current = bot?.id;
      if (!current) return;
      const nextId = neighborBotId(
        liveBots.map((item) => item.id),
        current,
        delta,
      );
      if (!nextId || nextId === current) return;
      void goToBot(nextId);
    },
    [liveBots, bot?.id, goToBot],
  );
  const runPaletteAction = useCallback(
    (id: PaletteActionId) => {
      setPaletteOpen(false);
      if (id === "hire") {
        if (!hiring.current) setHireOpen(true);
        return;
      }
      if (id === "room") {
        setRoomOpen(true);
        return;
      }
      if (id === "delete-room") {
        if (room) setRoomDelete(room);
        return;
      }
      if (id === "section") {
        setSectionOpen(true);
        return;
      }
      if (id === "plugins") {
        setPluginsOpen(true);
        return;
      }
      if (id === "knowledge") {
        setDesk(deskLibrary(desk));
        return;
      }
      if (id === "skills") {
        setDesk(deskLibrary(desk, SKILLS_LIBRARY_PATH));
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
    [desk, room, setDesk],
  );

  useHotkeys([
    {
      hotkey: "Mod+K",
      callback: () => {
        setPaletteOpen((open) => !open);
        setBotMenu(null);
        setRoomMenu(null);
        setSectionMenu(null);
      },
      options: {
        enabled: (!hireOpen && !settingsOpen && !pluginsOpen) || paletteOpen,
      },
    },
    {
      hotkey: "Mod+N",
      callback: () => {
        setPaletteOpen(false);
        if (!hiring.current) setHireOpen(true);
      },
      options: { enabled: !settingsOpen && !pluginsOpen },
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
      callback: () => {
        setBotMenu(null);
        setRoomMenu(null);
        setSectionMenu(null);
      },
      options: {
        enabled:
          (Boolean(botMenu) || Boolean(roomMenu) || Boolean(sectionMenu)) &&
          !paletteOpen,
      },
    },
    {
      hotkey: ROSTER_NEXT_HOTKEY,
      callback: () => cycleBots(1),
      options: {
        enabled: !blocking && !desk.library,
        ignoreInputs: false,
      },
    },
    {
      hotkey: ROSTER_PREV_HOTKEY,
      callback: () => cycleBots(-1),
      options: {
        enabled: !blocking && !desk.library,
        ignoreInputs: false,
      },
    },
    {
      hotkey: "j",
      callback: () => cycleBots(1),
      options: { enabled: !blocking && !desk.library },
    },
    {
      hotkey: "k",
      callback: () => cycleBots(-1),
      options: { enabled: !blocking && !desk.library },
    },
    {
      hotkey: "Escape",
      callback: () => setDesk(closeLibrary(desk)),
      options: {
        enabled: Boolean(desk.library) && !paletteOpen && !hireOpen,
      },
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
    if (!activeId || hiringThis || isRoom) return;
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
  }, [activeId, hiringThis, isRoom]);

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
      if (!bot?.id) return;
      setComputerFile({ botId: bot.id, path });
      setDesk(deskComputer());
    },
    [bot?.id, setDesk],
  );
  const openKnowledgeFile = useCallback(
    (path: string) => {
      setDesk(deskPeek(path));
    },
    [setDesk],
  );
  const downloadComputerFile = useCallback(
    (path: string) => {
      if (!bot?.id) return;
      return client.computer
        .download({ botId: bot.id, path })
        .then(saveComputerDownload);
    },
    [bot?.id],
  );
  const downloadKnowledgeFile = useCallback((path: string) => {
    return client.knowledge.download({ path }).then(saveComputerDownload);
  }, []);
  const computerOpenPath =
    computerFile && bot && computerFile.botId === bot.id
      ? computerFile.path
      : null;

  const paneMode = desk.library ? null : (desk.pane ?? null);
  const activePane =
    paneMode === "knowledge"
      ? "knowledge"
      : paneMode === "app" && openApp
        ? "app"
        : paneMode === "settings" && bot
          ? "settings"
          : paneMode === "computer" && bot
            ? "computer"
            : null;
  const pane = usePanePresence(activePane);
  const exitingApp = openApp ?? lastApp.current;

  return (
    <ComputerFileOpenProvider
      onOpen={openComputerFile}
      onDownload={bot ? downloadComputerFile : undefined}
    >
      <KnowledgeFileOpenProvider
        onOpen={openKnowledgeFile}
        onDownload={downloadKnowledgeFile}
      >
        <div
          className={cn(
            "chat-shell relative bg-bg",
            paneMode === "app" && "is-app",
            paneMode && paneMode !== "app" && "is-pane",
            paneMode === "knowledge" && "is-knowledge",
            desk.library && "is-library",
            rosterOpen && "is-roster",
          )}
        >
          <div
            className={cn(
              "chat-panel",
              side.resizing && "is-side-resizing",
              paneCol.resizing && "is-pane-resizing",
            )}
            style={
              {
                "--side-width": `${side.width}px`,
                "--pane-width": `${paneCol.width}px`,
              } as CSSProperties
            }
          >
            <aside
            className="chat-side flex min-h-0 flex-col px-2 pb-2"
            aria-label="Teammates"
            inert={narrow && !rosterOpen ? true : undefined}
          >
            <div className="flex flex-col gap-1.5 px-0.5 pt-1 pb-2">
              <div className="side-chrome drag flex min-h-8 items-center gap-1">
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
                  <SidebarCreateMenu
                    disabled={hiringThis}
                    active={hireOpen || roomOpen || sectionOpen}
                    onNewBot={() => {
                      if (!hiring.current) setHireOpen(true);
                    }}
                    onNewRoom={() => setRoomOpen(true)}
                    onNewSection={() => setSectionOpen(true)}
                  />
                </div>
              </div>
              <SearchTrigger
                onOpen={() => {
                  setBotMenu(null);
                  setRoomMenu(null);
                  setSectionMenu(null);
                  setPaletteOpen(true);
                }}
              />
            </div>
            <div className="grid flex-1 content-start gap-0.5 overflow-auto px-1">
              {ungroupedLive.map((row) =>
                row.kind === "bot" ? (
                  <BotRow
                    key={row.item.id}
                    item={row.item}
                    selected={!isRoom && row.item.id === currentBotId}
                    working={
                      !isRoom &&
                      row.item.id === currentBotId &&
                      (hiringThis || Boolean(working))
                    }
                    desk={desk}
                    workspaceSlug={props.workspace.slug}
                    onMenu={openBotMenu}
                    onPick={closeRoster}
                  />
                ) : (
                  <RoomRow
                    key={row.item.id}
                    item={row.item}
                    selected={row.item.id === props.roomId}
                    desk={desk}
                    workspaceSlug={props.workspace.slug}
                    onMenu={openRoomMenu}
                    onPick={closeRoster}
                  />
                ),
              )}
              {groupedBots.sections.map((bucket) => {
                const collapsed =
                  collapsedIds.has(bucket.section.id) &&
                  bot?.sectionId !== bucket.section.id;
                return (
                  <div key={bucket.section.id} className="mt-1">
                    <SectionHeader
                      name={bucket.section.name}
                      count={bucket.bots.length}
                      collapsed={collapsed}
                      onToggle={() => toggleSectionCollapsed(bucket.section.id)}
                      onMenu={(event) =>
                        openSectionMenu(
                          event,
                          sections.find((row) => row.id === bucket.section.id) ?? {
                            id: bucket.section.id,
                            workspaceId: props.workspace.id,
                            name: bucket.section.name,
                            position: bucket.section.position,
                            createdAt: "",
                            updatedAt: "",
                          },
                          bucket.bots.length,
                        )
                      }
                    />
                    {collapsed
                      ? null
                      : bucket.bots.map((item) => (
                          <BotRow
                            key={item.id}
                            item={item}
                            selected={!isRoom && item.id === currentBotId}
                            working={
                              !isRoom &&
                              item.id === currentBotId &&
                              (hiringThis || Boolean(working))
                            }
                            desk={desk}
                            workspaceSlug={props.workspace.slug}
                            onMenu={openBotMenu}
                            onPick={closeRoster}
                          />
                        ))}
                  </div>
                );
              })}
              {liveBots.length === 0 &&
              rooms.length === 0 &&
              archivedBots.length === 0 &&
              sections.length === 0 ? (
                <p className="empty">No teammates yet.</p>
              ) : null}
              {workspaceApps.length > 0 ? (
                <div className="mt-2">
                  <div className="px-1.5 py-1.5 text-[12px] text-muted">Apps</div>
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
            <div className="chat-foot mt-auto border-t border-line px-1 pt-1.5 pb-1">
              <nav className="chat-dock" aria-label="Office">
                <button
                  className="chat-dock-item"
                  type="button"
                  aria-current={
                    desk.library && !libraryShowsSkills(desk)
                      ? "page"
                      : undefined
                  }
                  onClick={() =>
                    setDesk(
                      desk.library && !libraryShowsSkills(desk)
                        ? deskClosed()
                        : deskLibrary(desk, null),
                    )
                  }
                >
                  <KnowledgeIcon className="size-5" />
                  <span>Knowledge</span>
                </button>
                <button
                  className="chat-dock-item"
                  type="button"
                  aria-current={libraryShowsSkills(desk) ? "page" : undefined}
                  onClick={() =>
                    setDesk(
                      libraryShowsSkills(desk)
                        ? deskClosed()
                        : deskLibrary(desk, SKILLS_LIBRARY_PATH),
                    )
                  }
                >
                  <SkillsIcon className="size-5" />
                  <span>Skills</span>
                </button>
                <LiveAppsDockItem />
                <button
                  className="chat-dock-item"
                  type="button"
                  aria-pressed={pluginsOpen}
                  onClick={() => setPluginsOpen(true)}
                >
                  <PlugIcon className="size-5" />
                  <span>Plugins</span>
                </button>
              </nav>
              <button
                className="mt-0.5 flex w-full items-center gap-2 rounded-lg border-0 bg-transparent px-1.5 py-1.5 text-left text-inherit hover:bg-hover"
                type="button"
                onClick={() => {
                  setSettingsTab("general");
                  setSettingsOpen(true);
                }}
              >
                <PersonAvatar
                  name={officeProfileLabel(me)}
                  image={me?.image}
                  className="size-6"
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight">
                  {officeProfileLabel(me)}
                </span>
                <CaretSwapIcon className="size-3.5 shrink-0 text-muted" />
              </button>
            </div>
            <button
              type="button"
              className="side-resize no-drag"
              aria-label="Resize teammates list"
              aria-orientation="vertical"
              aria-valuemin={SIDE_WIDTH_MIN}
              aria-valuemax={SIDE_WIDTH_MAX}
              aria-valuenow={side.width}
              aria-valuetext={`${side.width} pixels`}
              onPointerDown={side.onPointerDown}
              onPointerMove={side.onPointerMove}
              onPointerUp={side.onPointerUp}
              onPointerCancel={side.onPointerUp}
              onLostPointerCapture={side.onPointerUp}
              onKeyDown={side.onKeyDown}
              onDoubleClick={side.onDoubleClick}
            />
          </aside>
          <div className="chat-stage">
            <section
              className="chat-thread flex min-h-0 min-w-0 flex-col bg-bg-thread"
              inert={narrow && rosterOpen ? true : undefined}
            >
              <div className="thread-head drag flex items-center justify-between gap-2 border-b border-line px-3.5 py-2">
                {pokeView ? (
                  <button
                    className="no-drag flex min-w-0 items-center gap-2 border-0 bg-transparent p-0 text-inherit"
                    type="button"
                    onClick={() => setPokeView(null)}
                  >
                    <ChevronLeftIcon />
                    <strong className="truncate text-[13px] font-semibold tracking-tight">
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
                      className="flex min-w-0 items-center gap-2 border-0 bg-transparent p-0 text-inherit"
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
                      <strong className="truncate text-[13px] font-semibold tracking-tight">
                        {isRoom ? (room?.name ?? "Room") : (bot?.name ?? "—")}
                      </strong>
                    </button>
                  </div>
                )}
                <div className="no-drag flex shrink-0 items-center gap-1.5">
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
              ) : isRoom && props.roomId && room ? (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {mountedRoomIds.map((id) => {
                    const item = rooms.find((row: Room) => row.id === id);
                    if (!item) return null;
                    const isActive = item.id === props.roomId;
                    const itemMeta = isActive ? meta : readThreadMeta(item.id);
                    const itemError = isActive
                      ? error
                      : (itemMeta?.error ?? "");
                    const members = item.members.map((member) => ({
                      id: member.botId,
                      homeRoomId: member.homeRoomId,
                      name: member.name,
                      title: member.title,
                      archivedAt: member.archivedAt,
                      avatarColor: member.avatarColor,
                      avatarShape: member.avatarShape,
                    }));
                    return (
                      <KeptRoomThread
                        key={item.id}
                        roomId={item.id}
                        members={members}
                        active={isActive}
                        needsModel={Boolean(me?.needsModel)}
                        userId={me?.userId}
                        userName={me?.name}
                        userImage={me?.image ?? undefined}
                        placeholder={
                          me?.needsModel
                            ? "Add a model key to send"
                            : `Message ${item.name}`
                        }
                        error={itemError}
                        onNeedsModel={onNeedsModel}
                        stopRef={stopOffice}
                      />
                    );
                  })}
                </div>
              ) : bot ? (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {mountedOfficeIds.map((id) => {
                    const item = bots.find((row) => row.id === id);
                    if (!item) return null;
                    const isActive = item.id === bot.id;
                    const itemMeta = isActive ? meta : readThreadMeta(item.id);
                    const itemOpening = Boolean(itemMeta?.opening);
                    const itemError = isActive
                      ? error
                      : (itemMeta?.error ?? "");
                    return (
                      <KeptOfficeThread
                        key={item.id}
                        botId={item.id}
                        roomId={item.homeRoomId || item.id}
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
                        stopRef={stopOffice}
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
              {activePane && activePane !== "app" ? (
                <button
                  type="button"
                  className="pane-resize no-drag"
                  aria-label="Resize pane"
                  aria-orientation="vertical"
                  aria-valuemin={PANE_WIDTH_MIN}
                  aria-valuemax={PANE_WIDTH_MAX}
                  aria-valuenow={paneCol.width}
                  aria-valuetext={`${paneCol.width} pixels`}
                  onPointerDown={paneCol.onPointerDown}
                  onPointerMove={paneCol.onPointerMove}
                  onPointerUp={paneCol.onPointerUp}
                  onPointerCancel={paneCol.onPointerUp}
                  onLostPointerCapture={paneCol.onPointerUp}
                  onKeyDown={paneCol.onKeyDown}
                  onDoubleClick={paneCol.onDoubleClick}
                />
              ) : null}
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
              {pane.rendered === "knowledge" ? (
                <KnowledgePeek
                  key={desk.knowledge || "peek"}
                  path={desk.knowledge ?? ""}
                  onPath={(path) => setDesk(deskPeek(path))}
                  onOpenLibrary={(path) => setDesk(deskLibrary(desk, path))}
                  onClose={() => setDesk(closePeek(desk))}
                />
              ) : null}
            </div>
          </div>
          {desk.library ? (
            <KnowledgeLibrary
              path={desk.knowledge ?? null}
              folder={
                libraryShowsSkills(desk) ? SKILLS_LIBRARY_PATH : undefined
              }
              officeHref={
                props.roomId
                  ? (path) =>
                      officeKnowledgeHref({
                        workspaceSlug: props.workspace.slug,
                        roomId: props.roomId as string,
                        path,
                      })
                  : undefined
              }
              onPath={(path) => setDesk(deskLibrary(desk, path))}
              onClose={() => setDesk(closeLibrary(desk))}
            />
          ) : null}
          </div>
          <PluginsModal
            open={pluginsOpen}
            botId={activeId}
            meUserId={me?.userId}
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
          <CommandPalette
            open={paletteOpen}
            bots={[...liveBots, ...archivedBots]}
            rooms={rooms}
            apps={workspaceApps}
            files={knowledgeListQuery.data?.entries ?? []}
            roomName={isRoom ? room?.name : undefined}
            onClose={() => setPaletteOpen(false)}
            onBot={(botId) => {
              setPaletteOpen(false);
              setPokeView(null);
              void goToBot(botId, closeLibrary(desk));
            }}
            onRoom={(roomId) => {
              setPaletteOpen(false);
              setPokeView(null);
              void goToRoom(roomId, closeLibrary(desk));
            }}
            onApp={(appId) => {
              setPaletteOpen(false);
              setPokeView(null);
              openDocument({ appId });
            }}
            onFile={(path) => {
              setPaletteOpen(false);
              setPokeView(null);
              setDesk(deskLibrary(desk, path));
            }}
            onAction={runPaletteAction}
          />
          <HireMarketplaceModal
            open={hireOpen}
            onClose={() => setHireOpen(false)}
            onHire={(input) => void hire(input)}
          />
          <CreateRoomDialog
            open={roomOpen}
            bots={liveBots}
            onClose={() => setRoomOpen(false)}
            onCreate={(input) => void createRoom(input)}
          />
          <ConfirmRoomDeleteDialog
            room={roomDelete}
            onClose={() => setRoomDelete(null)}
            onConfirm={(item) => {
              setRoomDelete(null);
              void deleteRoom(item);
            }}
          />
          <SectionDialog
            open={sectionOpen}
            title="New section"
            confirm="Create"
            onClose={() => setSectionOpen(false)}
            onSubmit={(name) => void createSection(name)}
          />
          <SectionDialog
            open={Boolean(sectionRename)}
            title="Rename section"
            confirm="Save"
            initialName={sectionRename?.name ?? ""}
            onClose={() => setSectionRename(null)}
            onSubmit={(name) => {
              if (!sectionRename) return;
              void renameSection(sectionRename, name);
            }}
          />
          <BotContextMenu
            menu={botMenu}
            sections={sections.map((row) => ({ id: row.id, name: row.name }))}
            ownerUserId={me?.userId}
            onClose={() => setBotMenu(null)}
            onPin={(bot) => void togglePin(bot)}
            onArchive={(bot) => void toggleArchive(bot)}
            onShare={(bot) => void toggleShare(bot)}
            onMove={(bot, sectionId) => void moveBotToSection(bot, sectionId)}
            onPhase={setBotMenu}
            onDelete={(botId) => void deleteTeammate(botId)}
          />
          <RoomContextMenu
            menu={roomMenu}
            onClose={() => setRoomMenu(null)}
            onPhase={setRoomMenu}
            onDelete={(room) => {
              setRoomMenu(null);
              void deleteRoom(room);
            }}
          />
          <SectionContextMenu
            menu={sectionMenu}
            onClose={() => setSectionMenu(null)}
            onRename={(section) => {
              setSectionMenu(null);
              setSectionRename(section);
            }}
            onPhase={setSectionMenu}
            onDelete={(section) => {
              setSectionMenu(null);
              void deleteSection(section);
            }}
          />
        </div>
      </KnowledgeFileOpenProvider>
    </ComputerFileOpenProvider>
  );
}

function LiveAppsDockItem() {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        className="chat-dock-item"
        type="button"
        aria-label="Live apps, coming soon"
        onClick={() => setOpen(true)}
      >
        <LiveAppsIcon className="size-5" />
        <span>Live apps</span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        Coming soon
      </TooltipContent>
    </Tooltip>
  );
}
