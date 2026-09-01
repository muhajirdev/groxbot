import type { Bot, Routine } from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  filterComputerTree,
  nestComputerEntries,
  type ComputerTreeNode,
} from "../lib/computer-tree";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { ModalShell } from "../ui";
import {
  ChevronDownIcon,
  CloseIcon,
  FileIcon,
  GearIcon,
  ImageFileIcon,
  MarkdownFileIcon,
  MoreIcon,
  SearchIcon,
} from "./Icons";

const NONE_COLLAPSED = new Set<string>();
const CRONS = [
  { label: "Every day at 9:00", value: "0 9 * * *" },
  { label: "Every night at 22:00", value: "0 22 * * *" },
  { label: "Weekdays at 9:00", value: "0 9 * * 1-5" },
] as const;

export function ComputerPane(props: {
  bot: Bot;
  onSettings: () => void;
  onCollapse: () => void;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cron, setCron] = useState<string>(CRONS[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const botId = props.bot.id;
  const filesQuery = useQuery({
    ...orpc.computer.list.queryOptions({ input: { botId } }),
    refetchInterval: (queryState) =>
      queryState.state.data ? 15_000 : false,
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

  return (
    <aside className="pane computer-pane">
      <div className="pane-head drag">
        <span className="pane-title">{props.bot.name}'s screen</span>
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
                  onSelect={setSelected}
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
          {filesQuery.data?.truncated ? (
            <p className="explorer-empty">Showing the first 200 paths.</p>
          ) : null}
        </div>
        <section className="routines">
          <p className="muted">
            Routines are recurring tasks this Bot runs on a schedule.
          </p>
          {routines.length > 0 ? (
            <ul className="routine-list">
              {routines.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <span className="muted">{item.cron}</span>
                </li>
              ))}
            </ul>
          ) : null}
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
        </section>
      </div>
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
            disabled={busy || !name.trim() || !prompt.trim()}
            onClick={() => {
              setBusy(true);
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
                    caught instanceof Error
                      ? caught.message
                      : "Could not create",
                  ),
                )
                .finally(() => setBusy(false));
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

function TreeRows(props: {
  node: ComputerTreeNode;
  depth: number;
  selected: string | null;
  collapsed: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  const node = props.node;
  const open = node.kind !== "dir" || !props.collapsed.has(node.path);
  const on = props.selected === node.path;
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
              aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
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
            onClick={() => {
              if (node.kind === "dir") props.onToggle(node.path);
              else props.onSelect(node.path);
            }}
          >
            {node.name}
          </button>
          {node.kind === "file" && on ? (
            <button
              className="explorer-more"
              type="button"
              aria-label="Copy path"
              title="Copy path"
              onClick={() => {
                void navigator.clipboard.writeText(node.path);
              }}
            >
              <MoreIcon />
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
              onSelect={props.onSelect}
              onToggle={props.onToggle}
            />
          ))
        : null}
    </>
  );
}

function FileKindMark(props: { name: string }) {
  const kind = fileKind(props.name);
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

function fileKind(name: string): "pdf" | "image" | "svg" | "md" | "html" | "file" {
  const ext = name.includes(".")
    ? name.slice(name.lastIndexOf(".")).toLowerCase()
    : "";
  if (ext === ".pdf") return "pdf";
  if (ext === ".svg") return "svg";
  if (ext === ".md" || ext === ".markdown") return "md";
  if (ext === ".html" || ext === ".htm") return "html";
  if (
    ext === ".png" ||
    ext === ".jpg" ||
    ext === ".jpeg" ||
    ext === ".gif" ||
    ext === ".webp"
  ) {
    return "image";
  }
  return "file";
}
