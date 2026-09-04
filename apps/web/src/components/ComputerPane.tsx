import type { Bot, Routine } from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { saveComputerDownload } from "../lib/computer-download";
import {
  type ComputerTreeNode,
  filterComputerTree,
  nestComputerEntries,
} from "../lib/computer-tree";
import { userFacingError } from "../lib/errors";
import { OFFICE_MESSAGES_GC_TIME } from "../lib/office-messages";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import {
  formatRoutineWhen,
  officeTimezone,
} from "../lib/routine-schedule";
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
  SearchIcon,
} from "./Icons";

const NONE_COLLAPSED = new Set<string>();
const DEFAULT_CRON = "every day at 09:00";

export function ComputerPane(props: {
  bot: Bot;
  onSettings: () => void;
  onCollapse: () => void;
  openPath?: string | null;
  onPreviewClose?: () => void;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cron, setCron] = useState(DEFAULT_CRON);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creatingBusy, setCreatingBusy] = useState(false);
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
  const filesQuery = useQuery({
    ...orpc.computer.list.queryOptions({ input: { botId } }),
    gcTime: OFFICE_MESSAGES_GC_TIME,
    refetchInterval: (queryState) => (queryState.state.data ? 15_000 : false),
  });
  const routinesQuery = useQuery({
    queryKey: ["routines", botId],
    queryFn: () => client.routines.list({ botId }),
    staleTime: 30_000,
  });
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
        <section className="routines">
          <p className="muted">
            Recurring jobs this teammate runs on a schedule, even when you are
            away.
          </p>
          {routinesQuery.isError ? (
            <p className="error">
              {userFacingError(routinesQuery.error, "Could not load routines.")}
            </p>
          ) : null}
          {error && !creating ? <p className="error">{error}</p> : null}
          {routines.length > 0 ? (
            <ul className="routine-list">
              {routines.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span className="muted">
                      {formatRoutineWhen(item.cron, item.timezone)}
                      {item.active
                        ? item.nextRunAt
                          ? ` · next ${formatNextRun(item.nextRunAt)}`
                          : ""
                        : " · paused"}
                    </span>
                  </div>
                  <div className="routine-actions">
                    <button
                      className="text-btn"
                      type="button"
                      disabled={
                        busyId === item.id || (!item.active && archived)
                      }
                      onClick={() => {
                        setBusyId(item.id);
                        setError("");
                        void (
                          item.active
                            ? client.routines.pause({
                                botId,
                                id: item.id,
                              })
                            : client.routines.resume({
                                botId,
                                id: item.id,
                              })
                        )
                          .then(async () => {
                            await queryClient.invalidateQueries({
                              queryKey: ["routines", botId],
                            });
                          })
                          .catch((caught: unknown) =>
                            setError(
                              userFacingError(
                                caught,
                                "Could not update that routine.",
                              ),
                            ),
                          )
                          .finally(() => setBusyId(null));
                      }}
                    >
                      {item.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      className="text-btn danger"
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => {
                        setBusyId(item.id);
                        setError("");
                        void client.routines
                          .remove({ botId, id: item.id })
                          .then(async () => {
                            await queryClient.invalidateQueries({
                              queryKey: ["routines", botId],
                            });
                          })
                          .catch((caught: unknown) =>
                            setError(
                              userFacingError(
                                caught,
                                "Could not remove that routine.",
                              ),
                            ),
                          )
                          .finally(() => setBusyId(null));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {archived ? (
            <p className="muted">Archived teammates do not run routines.</p>
          ) : (
            <button
              className="create-routine"
              type="button"
              onClick={() => {
                setName("");
                setPrompt("");
                setCron(DEFAULT_CRON);
                setError("");
                setCreating(true);
              }}
            >
              Create Routine
            </button>
          )}
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
        open={creating}
        className="w-[min(360px,calc(100%-48px))] p-4"
        onClose={() => setCreating(false)}
      >
        <div className="grid gap-3">
          <h2 className="m-0 text-[15px] font-semibold tracking-tight">
            Create Routine
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
          <div className="flex justify-end gap-2">
            <Button
              className="px-3 py-1.5 text-[13px]"
              variant="ghost"
              type="button"
              onClick={() => setCreating(false)}
            >
              Close
            </Button>
            <Button
              className="px-3 py-1.5 text-[13px]"
              type="button"
              disabled={
                creatingBusy || !name.trim() || !prompt.trim() || !cron.trim()
              }
              onClick={() => {
                setCreatingBusy(true);
                setError("");
                void client.routines
                  .create({
                    botId: props.bot.id,
                    name,
                    prompt,
                    cron,
                    timezone: officeTimezone(),
                  })
                  .then(async () => {
                    await queryClient.invalidateQueries({
                      queryKey: ["routines", props.bot.id],
                    });
                    setCreating(false);
                  })
                  .catch((caught: unknown) =>
                    setError(
                      userFacingError(caught, "Could not create that routine."),
                    ),
                  )
                  .finally(() => setCreatingBusy(false));
              }}
            >
              Create
            </Button>
          </div>
        </div>
      </ModalShell>
    </aside>
  );
}

function formatNextRun(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
