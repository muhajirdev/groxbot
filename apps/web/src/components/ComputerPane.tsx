import type { Bot, Routine } from "@groxbot/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveComputerDownload } from "../lib/computer-download";
import {
  type ComputerTreeNode,
  filterComputerTree,
  nestComputerEntries,
} from "../lib/computer-tree";
import { useDebugMode } from "../lib/debug-mode";
import { userFacingError } from "../lib/errors";
import {
  clearOfficeDebugLines,
  useOfficeDebugLines,
} from "../lib/office-debug";
import { OFFICE_MESSAGES_GC_TIME } from "../lib/office-messages";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import {
  formatRoutineRow,
  officeTimezone,
} from "../lib/routine-schedule";
import {
  optimisticRoutine,
  readRoutines,
  replaceRoutine,
  routinesListQueryOptions,
  withRoutineActive,
  withRoutineFields,
  withoutRoutine,
  writeRoutines,
} from "../lib/routines-cache";
import { Button, Field, Input, ModalShell, Textarea } from "../ui";
import { ComputerFilePreview } from "./ComputerFilePreview";
import { RoutineScheduleField } from "./RoutineScheduleField";
import {
  CloseIcon,
  DownloadIcon,
  FileKindIcon,
  FolderIcon,
  FolderOpenIcon,
  GearIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
} from "./Icons";

const NONE_COLLAPSED = new Set<string>();
const DEFAULT_CRON = "every day at 09:00";

export function ComputerPane(props: {
  bot: Bot;
  /** Home room id — office Cap’n Web thread for debug logs. */
  roomId?: string;
  onSettings: () => void;
  onCollapse: () => void;
  openPath?: string | null;
  onPreviewClose?: () => void;
}) {
  const debug = useDebugMode();
  const roomId = (props.roomId || props.bot.homeRoomId || props.bot.id).trim();
  const debugLines = useOfficeDebugLines(roomId);
  const debugLogRef = useRef<HTMLPreElement | null>(null);
  const [sheet, setSheet] = useState<"create" | Routine | null>(null);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cron, setCron] = useState(DEFAULT_CRON);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(
    () => props.openPath ?? null,
  );
  const [previewPath, setPreviewPath] = useState<string | null>(
    () => props.openPath ?? null,
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const botId = props.bot.id;
  const archived = Boolean(props.bot.archivedAt);
  const openPath = props.openPath ?? null;
  useEffect(() => {
    if (!openPath) return;
    setQuery("");
    setSelected(openPath);
    setPreviewPath(openPath);
  }, [openPath]);
  useEffect(() => {
    const el = debugLogRef.current;
    if (!el || !debug) return;
    el.scrollTop = el.scrollHeight;
  }, [debug, debugLines]);
  const filesQuery = useQuery({
    ...orpc.computer.list.queryOptions({ input: { botId } }),
    gcTime: OFFICE_MESSAGES_GC_TIME,
    refetchInterval: (queryState) => (queryState.state.data ? 15_000 : false),
  });
  const routinesQuery = useQuery(routinesListQueryOptions(botId));
  const routines: Routine[] = routinesQuery.data ?? [];
  const tree = useMemo(() => {
    const nested = nestComputerEntries(filesQuery.data?.entries ?? []);
    return filterComputerTree(nested, query);
  }, [filesQuery.data, query]);
  const searching = query.trim().length > 0;
  const downloadFile = (path: string) => {
    if (downloading) return;
    setDownloading(path);
    setDownloadError("");
    void client.computer
      .download({ botId, path })
      .then((file) => {
        saveComputerDownload(file);
      })
      .catch((caught: unknown) => {
        setDownloadError(
          userFacingError(caught, "Could not download that file"),
        );
      })
      .finally(() => setDownloading(null));
  };
  const closeSheet = () => setSheet(null);
  const openCreate = () => {
    setName("");
    setPrompt("");
    setCron(DEFAULT_CRON);
    setError("");
    setSheet("create");
  };
  const openEdit = (item: Routine) => {
    setName(item.name);
    setPrompt(item.prompt);
    setCron(item.cron);
    setError("");
    setSheet(item);
  };
  const formReady = Boolean(name.trim() && prompt.trim() && cron.trim());
  const editing = sheet && sheet !== "create" ? sheet : null;
  const toggleRoutine = (item: Routine) => {
    if (busyId || (!item.active && archived)) return;
    const snapshot = readRoutines(botId);
    writeRoutines(botId, withRoutineActive(snapshot, item.id, !item.active));
    setBusyId(item.id);
    setError("");
    void (
      item.active
        ? client.routines.pause({ botId, id: item.id })
        : client.routines.resume({ botId, id: item.id })
    )
      .then((next) => {
        writeRoutines(botId, replaceRoutine(readRoutines(botId), item.id, next));
      })
      .catch((caught: unknown) => {
        writeRoutines(botId, snapshot);
        setError(userFacingError(caught, "Could not update that routine."));
      })
      .finally(() => setBusyId(null));
  };
  const removeRoutine = (id: string) => {
    if (busyId) return;
    const snapshot = readRoutines(botId);
    writeRoutines(botId, withoutRoutine(snapshot, id));
    closeSheet();
    setBusyId(id);
    setError("");
    void client.routines
      .remove({ botId, id })
      .catch((caught: unknown) => {
        writeRoutines(botId, snapshot);
        setError(userFacingError(caught, "Could not remove that routine."));
      })
      .finally(() => setBusyId(null));
  };
  const saveRoutine = (item: Routine) => {
    const patch = {
      name: name.trim(),
      prompt: prompt.trim(),
      cron: cron.trim(),
      timezone: officeTimezone(),
    };
    if (!patch.name || !patch.prompt || !patch.cron) return;
    const snapshot = readRoutines(botId);
    writeRoutines(botId, withRoutineFields(snapshot, item.id, patch));
    closeSheet();
    setError("");
    void client.routines
      .update({ botId, id: item.id, ...patch })
      .then((next) => {
        writeRoutines(botId, replaceRoutine(readRoutines(botId), item.id, next));
      })
      .catch((caught: unknown) => {
        writeRoutines(botId, snapshot);
        setError(userFacingError(caught, "Could not save that routine."));
      });
  };
  const testRun = (item: Routine) => {
    if (archived) return;
    const patch = {
      name: name.trim(),
      prompt: prompt.trim(),
      cron: cron.trim(),
      timezone: officeTimezone(),
    };
    if (!patch.name || !patch.prompt || !patch.cron) return;
    const snapshot = readRoutines(botId);
    const dirty =
      patch.name !== item.name ||
      patch.prompt !== item.prompt ||
      patch.cron !== item.cron;
    if (dirty) {
      writeRoutines(botId, withRoutineFields(snapshot, item.id, patch));
    }
    closeSheet();
    setError("");
    let saved = false;
    const persist = dirty
      ? client.routines
          .update({ botId, id: item.id, ...patch })
          .then((next) => {
            saved = true;
            writeRoutines(
              botId,
              replaceRoutine(readRoutines(botId), item.id, next),
            );
            return next.id;
          })
      : Promise.resolve(item.id);
    void persist
      .then((id) => client.routines.run({ botId, id }))
      .catch((caught: unknown) => {
        if (dirty && !saved) writeRoutines(botId, snapshot);
        setError(userFacingError(caught, "Could not run that routine."));
      });
  };
  const createRoutine = () => {
    const draft = optimisticRoutine({
      botId,
      name,
      prompt,
      cron,
      timezone: officeTimezone(),
    });
    if (!draft.name || !draft.prompt || !draft.cron) return;
    const snapshot = readRoutines(botId);
    writeRoutines(botId, [...snapshot, draft]);
    closeSheet();
    setError("");
    void client.routines
      .create({
        botId,
        name: draft.name,
        prompt: draft.prompt,
        cron: draft.cron,
        timezone: draft.timezone,
      })
      .then((next) => {
        writeRoutines(botId, replaceRoutine(readRoutines(botId), draft.id, next));
      })
      .catch((caught: unknown) => {
        writeRoutines(botId, snapshot);
        setError(userFacingError(caught, "Could not create that routine."));
      });
  };

  return (
    <aside className="pane computer-pane">
      <div className="pane-head drag">
        <span className="pane-title">{props.bot.name}'s computer</span>
        <div className="row tight no-drag">
          <button
            className="icon-btn"
            type="button"
            aria-label="Bot settings"
            title="Settings"
            onClick={props.onSettings}
          >
            <GearIcon />
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="Close computer"
            title="Close"
            onClick={props.onCollapse}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="pane-scroll">
        <label className="search-field explorer-search">
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            aria-label="Search files"
          />
        </label>
        <div className="explorer">
          {filesQuery.isPending && tree.length === 0 ? (
            <p className="explorer-empty">Opening…</p>
          ) : filesQuery.error ? (
            <p className="explorer-empty">
              {userFacingError(filesQuery.error, "Could not read files")}
            </p>
          ) : tree.length === 0 ? (
            <p className="explorer-empty">
              {searching
                ? "No files match."
                : "Files this teammate writes — and files you attach — land here."}
            </p>
          ) : (
            <ul className="explorer-tree">
              {tree.map((node) => (
                <TreeRows
                  key={node.path}
                  node={node}
                  depth={0}
                  selected={selected}
                  collapsed={searching ? NONE_COLLAPSED : collapsed}
                  downloading={downloading}
                  onSelect={setSelected}
                  onPreview={setPreviewPath}
                  onDownload={downloadFile}
                  onToggle={(path) => {
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(path)) next.delete(path);
                      else next.add(path);
                      return next;
                    });
                  }}
                />
              ))}
            </ul>
          )}
          {downloadError ? (
            <p className="explorer-empty">{downloadError}</p>
          ) : null}
          {filesQuery.data?.truncated ? (
            <p className="explorer-empty">Showing the first 200 paths.</p>
          ) : null}
        </div>
        {debug ? (
          <section className="computer-debug">
            <div className="routines-head">
              <span>Debug</span>
              <button
                className="mini"
                type="button"
                disabled={debugLines.length === 0}
                onClick={() => clearOfficeDebugLines(roomId)}
              >
                Clear
              </button>
            </div>
            <pre
              ref={debugLogRef}
              className="computer-debug-log"
              aria-label="Turn timing log"
            >
              {debugLines.length > 0
                ? debugLines.join("\n")
                : "Send a message to see turn timing…"}
            </pre>
          </section>
        ) : null}
        <section className="routines">
          <div className="routines-head">
            <span>Routines</span>
            {archived ? null : (
              <button
                className="icon-btn"
                type="button"
                aria-label="Create routine"
                onClick={openCreate}
              >
                <PlusIcon />
              </button>
            )}
          </div>
          {routinesQuery.isError ? (
            <p className="error">
              {userFacingError(routinesQuery.error, "Could not load routines.")}
            </p>
          ) : null}
          {error && !sheet ? <p className="error">{error}</p> : null}
          {routines.length > 0 ? (
            <ul className="routine-list">
              {routines.map((item) => (
                <li key={item.id}>
                  <button
                    className="icon-btn routine-toggle"
                    type="button"
                    aria-label={item.active ? "Pause" : "Resume"}
                    disabled={busyId === item.id || (!item.active && archived)}
                    onClick={() => toggleRoutine(item)}
                  >
                    {item.active ? <PauseIcon /> : <PlayIcon />}
                  </button>
                  <button
                    className="routine-copy"
                    type="button"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => openEdit(item)}
                  >
                    <strong>{item.name}</strong>
                    <span>{formatRoutineRow(item)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : archived ? (
            <p className="muted">Archived teammates do not run routines.</p>
          ) : null}
        </section>
      </div>
      <ComputerFilePreview
        botId={botId}
        path={previewPath}
        downloading={Boolean(downloading)}
        onClose={() => {
          setPreviewPath(null);
          props.onPreviewClose?.();
        }}
        onDownload={downloadFile}
      />
      <ModalShell
        open={Boolean(sheet)}
        className="w-[min(360px,calc(100%-48px))] p-4"
        onClose={closeSheet}
      >
        <div className="grid gap-3">
          <h2 className="m-0 text-[15px] font-semibold tracking-tight">
            {editing ? "Edit Routine" : "Create Routine"}
          </h2>
          <Field label="Name" className="mb-0">
            <Input
              value={name}
              placeholder="Nightly Gmail check"
              onValueChange={setName}
            />
          </Field>
          <RoutineScheduleField
            cron={cron}
            timezone={officeTimezone()}
            onChange={setCron}
          />
          <Field label="What to do" className="mb-0">
            <Textarea
              rows={3}
              className="min-h-[72px]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </Field>
          {error ? <p className="error m-0">{error}</p> : null}
          {editing ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                className="text-danger hover:text-danger"
                variant="text"
                type="button"
                onClick={() => removeRoutine(editing.id)}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  className="px-3 py-1.5 text-[13px]"
                  variant="ghost"
                  type="button"
                  disabled={!formReady || archived}
                  onClick={() => testRun(editing)}
                >
                  Test run
                </Button>
                <Button
                  className="px-3 py-1.5 text-[13px]"
                  type="button"
                  disabled={!formReady}
                  onClick={() => saveRoutine(editing)}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button
                className="px-3 py-1.5 text-[13px]"
                variant="ghost"
                type="button"
                onClick={closeSheet}
              >
                Close
              </Button>
              <Button
                className="px-3 py-1.5 text-[13px]"
                type="button"
                disabled={!formReady}
                onClick={createRoutine}
              >
                Create
              </Button>
            </div>
          )}
        </div>
      </ModalShell>
    </aside>
  );
}

function TreeRows(props: {
  node: ComputerTreeNode;
  depth: number;
  selected: string | null;
  collapsed: Set<string>;
  downloading: string | null;
  onSelect: (path: string) => void;
  onPreview: (path: string) => void;
  onDownload: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  const node = props.node;
  const open = node.kind !== "dir" || !props.collapsed.has(node.path);
  const on = props.selected === node.path;
  const saving = props.downloading === node.path;
  return (
    <>
      <li>
        <div
          className={`explorer-row${on ? " on" : ""}${node.kind === "dir" ? " dir" : ""}`}
          style={{ paddingLeft: 8 + props.depth * 16 }}
        >
          {node.kind === "dir" ? (
            <button
              className="explorer-chevron"
              type="button"
              aria-label={
                open ? `Collapse ${node.name}` : `Expand ${node.name}`
              }
              onClick={() => props.onToggle(node.path)}
            >
              {open ? <FolderOpenIcon /> : <FolderIcon />}
            </button>
          ) : (
            <span className="explorer-mark" aria-hidden>
              <FileKindIcon name={node.name} />
            </span>
          )}
          <button
            className="explorer-name"
            type="button"
            aria-label={
              node.kind === "file" ? `Preview ${node.name}` : node.name
            }
            title={node.kind === "file" ? "Preview" : undefined}
            onClick={() => {
              if (node.kind === "dir") {
                props.onToggle(node.path);
                return;
              }
              props.onSelect(node.path);
              props.onPreview(node.path);
            }}
          >
            {node.name}
          </button>
          {node.kind === "file" ? (
            <button
              className={`explorer-more${saving ? " busy" : ""}`}
              type="button"
              aria-label={`Download ${node.name}`}
              aria-busy={saving}
              title="Download"
              disabled={Boolean(props.downloading)}
              onClick={() => props.onDownload(node.path)}
            >
              <DownloadIcon />
            </button>
          ) : null}
        </div>
      </li>
      {node.kind === "dir" && open
        ? node.children.map((child) => (
            <TreeRows
              key={child.path}
              node={child}
              depth={props.depth + 1}
              selected={props.selected}
              collapsed={props.collapsed}
              downloading={props.downloading}
              onSelect={props.onSelect}
              onPreview={props.onPreview}
              onDownload={props.onDownload}
              onToggle={props.onToggle}
            />
          ))
        : null}
    </>
  );
}
