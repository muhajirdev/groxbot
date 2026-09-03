import type { Bot, Routine } from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { saveComputerDownload } from "../lib/computer-download";
import { computerFileKind } from "../lib/computer-preview";
import {
  type ComputerTreeNode,
  filterComputerTree,
  nestComputerEntries,
} from "../lib/computer-tree";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { THINK_MESSAGES_GC_TIME } from "../lib/think-messages";
import { ModalShell } from "../ui";
import { ComputerFilePreview } from "./ComputerFilePreview";
import {
  ChevronDownIcon,
  CloseIcon,
  DownloadIcon,
  FileIcon,
  GearIcon,
  ImageFileIcon,
  MarkdownFileIcon,
  SearchIcon,
} from "./Icons";

const NONE_COLLAPSED = new Set<string>();
const CRONS = [
  { label: "Every day at 9:00", value: "every day at 09:00" },
  { label: "Every night at 22:00", value: "every day at 22:00" },
  { label: "Weekdays at 9:00", value: "every weekday at 09:00" },
  { label: "Every 30 minutes", value: "every 30 minutes" },
] as const;

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
  const [cron, setCron] = useState<string>(CRONS[0].value);
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
    gcTime: THINK_MESSAGES_GC_TIME,
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
                      {item.cron}
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
                setCron(CRONS[0].value);
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
      <ModalShell open={creating} onClose={() => setCreating(false)}>
        <h2>Create Routine</h2>
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nightly Gmail check"
          />
        </label>
        <label className="field">
          <span>Schedule</span>
          <select value={cron} onChange={(e) => setCron(e.target.value)}>
            {CRONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>What to do</span>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="row">
          <button
            className="btn"
            type="button"
            disabled={creatingBusy || !name.trim() || !prompt.trim()}
            onClick={() => {
              setCreatingBusy(true);
              setError("");
              void client.routines
                .create({
                  botId: props.bot.id,
                  name,
                  prompt,
                  cron,
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
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => setCreating(false)}
          >
            Close
          </button>
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
              className={`explorer-chevron${open ? "" : " closed"}`}
              type="button"
              aria-label={
                open ? `Collapse ${node.name}` : `Expand ${node.name}`
              }
              onClick={() => props.onToggle(node.path)}
            >
              <ChevronDownIcon />
            </button>
          ) : (
            <FileKindMark name={node.name} />
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

function FileKindMark(props: { name: string }) {
  const kind = computerFileKind(props.name);
  if (kind === "image") {
    return (
      <span className="explorer-mark image" aria-hidden>
        <ImageFileIcon />
      </span>
    );
  }
  if (kind === "md") {
    return (
      <span className="explorer-mark md" aria-hidden>
        <MarkdownFileIcon />
      </span>
    );
  }
  return (
    <span className={`explorer-mark ${kind}`} aria-hidden>
      <FileIcon />
    </span>
  );
}
