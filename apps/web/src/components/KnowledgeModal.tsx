import type { KnowledgeList } from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { bytesToBase64 } from "../lib/computer-attachment";
import { computerFileKind } from "../lib/computer-preview";
import { saveComputerDownload } from "../lib/computer-download";
import { userFacingError } from "../lib/errors";
import {
  SKILL_IMPORT_PLACEHOLDER,
  skillImportSummary,
} from "../lib/knowledge-import";
import { insertComposerText } from "../lib/knowledge-slash";
import {
  filterKnowledgeTree,
  isOfficeSkillPath,
  nestKnowledgeTree,
  type KnowledgeTreeNode,
} from "../lib/knowledge-tree";
import {
  knowledgeUploadPath,
  optimisticKnowledgeEntry,
  seedKnowledgePreview,
  upsertKnowledgeEntry,
} from "../lib/knowledge-upload";
import {
  indexKnowledgeGraph,
  knowledgeGraphBacklinks,
} from "../lib/knowledge-graph";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { THINK_MESSAGES_GC_TIME } from "../lib/think-messages";
import { Button, cn, Field, Input, ModalShell, Textarea } from "../ui";
import { KnowledgeFilePreview } from "./KnowledgeFilePreview";
import { KnowledgeGraphMap } from "./KnowledgeGraph";
import {
  ChevronDownIcon,
  CloseIcon,
  DownloadIcon,
  FileIcon,
  GitHubIcon,
  GraphIcon,
  ImageFileIcon,
  KnowledgeIcon,
  MarkdownFileIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "./Icons";

type Draft = { path: string; content: string };

const ROOT_COLLAPSED = new Set<string>();

export function KnowledgeModal(props: {
  open: boolean;
  initialPath?: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const listKey = orpc.knowledge.list.queryOptions().queryKey;
  const graphKey = orpc.knowledge.graph.queryOptions().queryKey;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(
    props.initialPath ?? null,
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [localFiles, setLocalFiles] = useState<Record<string, File>>({});
  const listQuery = useQuery({
    ...orpc.knowledge.list.queryOptions(),
    enabled: props.open,
    gcTime: THINK_MESSAGES_GC_TIME,
  });
  const graphQuery = useQuery({
    ...orpc.knowledge.graph.queryOptions(),
    enabled: props.open,
    gcTime: THINK_MESSAGES_GC_TIME,
  });
  const graphIndex = useMemo(
    () =>
      indexKnowledgeGraph({
        paths: graphQuery.data?.paths ?? [],
        out: graphQuery.data?.out ?? [],
      }),
    [graphQuery.data],
  );
  const entries = listQuery.data?.entries ?? [];
  const files = useMemo(
    () => new Set(entries.map((row) => row.path)),
    [entries],
  );
  const selectedEntry = entries.find((row) => row.path === selected) ?? null;
  const canPreview = Boolean(
    selected && files.has(selected) && !draft && !importing,
  );
  const tree = useMemo(() => {
    const nested = nestKnowledgeTree(entries);
    return filterKnowledgeTree(nested, query);
  }, [entries, query]);
  const searching = query.trim().length > 0;
  const localFile = selected ? (localFiles[selected] ?? null) : null;

  function openPath(path: string) {
    setDraft(null);
    setQuery("");
    setSelected(path);
    setCollapsed((current) => {
      const next = new Set(current);
      const parts = path.split("/").filter(Boolean);
      for (let i = 1; i < parts.length; i++) {
        next.delete(parts.slice(0, i).join("/"));
      }
      return next;
    });
  }

  useEffect(() => {
    if (!props.open) return;
    setQuery("");
    setDraft(null);
    setImporting(false);
    setMapOpen(false);
    setError("");
    setSelected(props.initialPath ?? null);
  }, [props.open, props.initialPath]);

  async function refresh(path?: string) {
    await queryClient.invalidateQueries({ queryKey: listKey });
    await queryClient.invalidateQueries({ queryKey: graphKey });
    if (path) {
      setSelected(path);
      await queryClient.invalidateQueries({
        queryKey: orpc.knowledge.read.queryOptions({ input: { path } }).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.knowledge.download.queryOptions({ input: { path } })
          .queryKey,
      });
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const saved = await client.knowledge.write({
        path: draft.path.trim(),
        content: draft.content,
      });
      setDraft(null);
      await refresh(saved.path);
    } catch (caught: unknown) {
      setError(userFacingError(caught, "Could not save that"));
    } finally {
      setBusy(false);
    }
  }

  async function importSkill(source: string) {
    setBusy(true);
    setError("");
    try {
      const result = await client.knowledge.importSkill({ source: source.trim() });
      const summary = skillImportSummary(result);
      if (result.imported.length === 0) {
        setError(summary);
        return;
      }
      setImporting(false);
      await refresh(result.imported[0]?.path);
    } catch (caught: unknown) {
      setError(userFacingError(caught, "Could not import that skill"));
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await client.knowledge.remove({ path: selected });
      setLocalFiles((current) => {
        const next = { ...current };
        delete next[selected];
        return next;
      });
      setSelected(null);
      await refresh();
    } catch (caught: unknown) {
      setError(userFacingError(caught, "Could not remove that"));
    } finally {
      setBusy(false);
    }
  }

  function uploadFile(file: File) {
    const folder =
      selected && !files.has(selected) ? selected : parentOf(selected);
    const path = knowledgeUploadPath(folder, file.name);
    const entry = optimisticKnowledgeEntry(path, file);
    let snapshot: KnowledgeList | undefined;
    setError("");
    setDraft(null);
    setImporting(false);
    queryClient.setQueryData<KnowledgeList>(listKey, (current) => {
      snapshot = current;
      return upsertKnowledgeEntry(current, entry);
    });
    setLocalFiles((current) => ({ ...current, [path]: file }));
    setSelected(path);
    void file
      .arrayBuffer()
      .then(async (buffer) => {
        const bytes = new Uint8Array(buffer);
        await client.knowledge.write({
          path,
          content: bytesToBase64(bytes),
          encoding: "base64",
          mediaType: file.type || undefined,
        });
        const seed = seedKnowledgePreview(path, file, bytes);
        if (seed.read) {
          queryClient.setQueryData(
            orpc.knowledge.read.queryOptions({ input: { path } }).queryKey,
            seed.read,
          );
        }
        if (seed.download) {
          queryClient.setQueryData(
            orpc.knowledge.download.queryOptions({ input: { path } }).queryKey,
            seed.download,
          );
        }
        setLocalFiles((current) => {
          const next = { ...current };
          delete next[path];
          return next;
        });
        await queryClient.invalidateQueries({ queryKey: listKey });
        await queryClient.invalidateQueries({ queryKey: graphKey });
      })
      .catch((caught: unknown) => {
        queryClient.setQueryData(listKey, snapshot);
        setLocalFiles((current) => {
          const next = { ...current };
          delete next[path];
          return next;
        });
        setSelected((current) => (current === path ? null : current));
        setError(userFacingError(caught, "Could not add that file"));
      });
  }

  function downloadSelected() {
    if (!selected || downloading) return;
    const pending = localFile;
    if (pending) {
      saveLocalFile(pending, selected);
      return;
    }
    setDownloading(true);
    setError("");
    void client.knowledge
      .download({ path: selected })
      .then((file) => {
        saveComputerDownload(file);
      })
      .catch((caught: unknown) => {
        setError(userFacingError(caught, "Could not download that file"));
      })
      .finally(() => setDownloading(false));
  }

  const empty = !listQuery.isPending && entries.length === 0 && !query.trim();

  return (
    <ModalShell
      open={props.open}
      wide
      onClose={props.onClose}
      className="knowledge-modal"
    >
      <div className="flex items-center justify-between border-b border-line px-[18px] py-3.5">
        <h2 className="m-0 flex items-center gap-2 text-lg">
          <KnowledgeIcon />
          Knowledge
        </h2>
        <button
          className="icon-btn"
          type="button"
          aria-label="Close"
          onClick={props.onClose}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="knowledge-split">
        <aside className="knowledge-nav">
          <label className="search-field explorer-search">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the office…"
              aria-label="Search knowledge"
            />
          </label>
          <div className="knowledge-adds">
            <button
              className="btn ghost tight"
              type="button"
              onClick={() => {
                const folder =
                  selected && !files.has(selected)
                    ? selected
                    : parentOf(selected);
                setImporting(false);
                setMapOpen(false);
                setDraft({
                  path: folder ? `${folder}/` : "skills/",
                  content: "",
                });
                setSelected(null);
              }}
            >
              <PlusIcon /> New
            </button>
            <button
              className="btn ghost tight"
              type="button"
              onClick={() => fileRef.current?.click()}
            >
              <PlusIcon /> Upload
            </button>
            <button
              className="btn ghost tight"
              type="button"
              onClick={() => {
                setDraft(null);
                setError("");
                setMapOpen(false);
                setImporting(true);
              }}
            >
              <GitHubIcon /> Import
            </button>
            <button
              className="btn ghost tight"
              type="button"
              aria-pressed={mapOpen}
              onClick={() => {
                setDraft(null);
                setImporting(false);
                setError("");
                setMapOpen((open) => !open);
              }}
            >
              <GraphIcon /> Map
            </button>
            <input
              ref={fileRef}
              className="hidden"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) uploadFile(file);
              }}
            />
          </div>
          <div className="explorer knowledge-tree">
            {listQuery.isPending && entries.length === 0 ? (
              <p className="explorer-empty">Opening…</p>
            ) : listQuery.error ? (
              <p className="explorer-empty">
                {userFacingError(listQuery.error, "Could not read knowledge")}
              </p>
            ) : empty ? (
              <p className="explorer-empty">Empty. Add a file, import a skill, or drop one in.</p>
            ) : (
              <>
                <ul className="explorer-tree">
                  {tree.map((node) => (
                    <TreeRows
                      key={node.path}
                      node={node}
                      depth={0}
                      selected={selected}
                      collapsed={searching ? ROOT_COLLAPSED : collapsed}
                      onSelect={(path) => {
                        setDraft(null);
                        setImporting(false);
                        setMapOpen(false);
                        setSelected(path);
                      }}
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
                {listQuery.data?.truncated ? (
                  <p className="explorer-empty">Showing the first 800 files.</p>
                ) : null}
              </>
            )}
          </div>
        </aside>
        <section className="knowledge-preview">
          {error ? <p className="error">{error}</p> : null}
          {draft ? (
            <DraftForm
              draft={draft}
              busy={busy}
              onChange={setDraft}
              onSave={() => void saveDraft()}
              onCancel={() => setDraft(null)}
            />
          ) : importing ? (
            <ImportForm
              busy={busy}
              onImport={(source) => void importSkill(source)}
              onCancel={() => setImporting(false)}
            />
          ) : mapOpen ? (
            graphQuery.isPending && !graphQuery.data ? (
              <p className="explorer-empty knowledge-hint">Opening map…</p>
            ) : graphQuery.error ? (
              <p className="explorer-empty">
                {userFacingError(graphQuery.error, "Could not load the map")}
              </p>
            ) : (
              <KnowledgeGraphMap
                paths={graphQuery.data?.paths ?? []}
                out={graphQuery.data?.out ?? []}
                selected={selected}
                files={files}
                onSelect={(path) => {
                  setDraft(null);
                  setImporting(false);
                  setSelected(path);
                }}
                onOpen={(path) => {
                  setMapOpen(false);
                  openPath(path);
                }}
              />
            )
          ) : canPreview && selected ? (
            <PreviewPane
              path={selected}
              title={selectedEntry?.title ?? selected}
              description={selectedEntry?.description ?? ""}
              mediaType={selectedEntry?.mediaType}
              localFile={localFile}
              files={files}
              backlinks={knowledgeGraphBacklinks(graphIndex, selected)}
              onOpen={openPath}
              busy={busy}
              downloading={downloading}
              onUse={
                isOfficeSkillPath(selected)
                  ? () => {
                      insertComposerText(
                        `/${selectedEntry?.title || selected} `,
                      );
                      props.onClose();
                    }
                  : undefined
              }
              onDownload={downloadSelected}
              onRemove={() => void removeSelected()}
            />
          ) : (
            <p className="explorer-empty knowledge-hint">
              {selected && !files.has(selected)
                ? "A folder. Add a file, or upload into it."
                : "How the office works — playbooks in skills/, notes, files. Folders are yours."}
            </p>
          )}
        </section>
      </div>
    </ModalShell>
  );
}

function PreviewPane(props: {
  path: string;
  title: string;
  description: string;
  mediaType?: string;
  localFile?: File | null;
  files: ReadonlySet<string>;
  backlinks: string[];
  onOpen: (path: string) => void;
  busy: boolean;
  downloading: boolean;
  onUse?: () => void;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const skill = isOfficeSkillPath(props.path);
  return (
    <>
      <div className="knowledge-preview-head">
        <div>
          <p className="knowledge-kicker">
            {skill ? `/${props.title}` : props.path}
          </p>
          <h3>{props.title}</h3>
          {props.description ? (
            <p className="muted">{props.description}</p>
          ) : null}
          <KnowledgeBacklinks sources={props.backlinks} onOpen={props.onOpen} />
        </div>
        <div className="row tight">
          {props.onUse ? (
            <Button type="button" variant="mini" onClick={props.onUse}>
              Use in chat
            </Button>
          ) : null}
          <button
            className="icon-btn"
            type="button"
            aria-label="Download"
            title="Download"
            disabled={props.downloading}
            onClick={props.onDownload}
          >
            <DownloadIcon />
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="Remove"
            disabled={props.busy}
            onClick={props.onRemove}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      <div className="knowledge-preview-body">
        <KnowledgeFilePreview
          path={props.path}
          mediaType={props.mediaType}
          localFile={props.localFile}
          files={props.files}
          onOpen={props.onOpen}
        />
      </div>
    </>
  );
}

function KnowledgeBacklinks(props: {
  sources: string[];
  onOpen: (path: string) => void;
}) {
  const sources = props.sources;
  if (sources.length === 0) return null;
  return (
    <p className="knowledge-backlinks">
      Linked from{" "}
      {sources.map((source, index) => (
        <span key={source}>
          {index > 0 ? ", " : null}
          <button
            type="button"
            className="knowledge-link"
            onClick={() => props.onOpen(source)}
          >
            {source}
          </button>
        </span>
      ))}
    </p>
  );
}

function DraftForm(props: {
  draft: Draft;
  busy: boolean;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const ready = Boolean(props.draft.path.trim() && props.draft.content.trim());
  return (
    <form
      className="knowledge-draft"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) props.onSave();
      }}
    >
      <h3>New file</h3>
      <Field label="Path">
        <Input
          value={props.draft.path}
          onChange={(event) =>
            props.onChange({ ...props.draft, path: event.target.value })
          }
          placeholder="skills/weekly-update/SKILL.md"
        />
      </Field>
      <Field label="Contents">
        <Textarea
          rows={10}
          value={props.draft.content}
          onChange={(event) =>
            props.onChange({ ...props.draft, content: event.target.value })
          }
        />
      </Field>
      <div className="row">
        <Button type="submit" disabled={props.busy || !ready}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={props.onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ImportForm(props: {
  busy: boolean;
  onImport: (source: string) => void;
  onCancel: () => void;
}) {
  const [source, setSource] = useState("");
  const ready = source.trim().length > 0;
  return (
    <form
      className="knowledge-draft"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) props.onImport(source);
      }}
    >
      <h3>Import skill</h3>
      <p className="muted knowledge-import-copy">
        Copied into skills/ as a playbook. A SKILL.md anywhere still counts.
      </p>
      <Field
        label="GitHub"
        hint="owner/repo, owner/repo/skill-name, or a SKILL.md URL."
      >
        <Input
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder={SKILL_IMPORT_PLACEHOLDER}
          autoFocus
        />
      </Field>
      <div className="row">
        <Button type="submit" disabled={props.busy || !ready}>
          Import
        </Button>
        <Button type="button" variant="ghost" onClick={props.onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function TreeRows(props: {
  node: KnowledgeTreeNode;
  depth: number;
  selected: string | null;
  collapsed: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  const node = props.node;
  const folder = node.kind === "dir";
  const open = !folder || !props.collapsed.has(node.path);
  const on = props.selected === node.path;
  return (
    <>
      <li>
        <div
          className={cn("explorer-row", on && "on", folder && "dir")}
          style={{ paddingLeft: 8 + props.depth * 16 }}
        >
          {folder ? (
            <button
              className={cn("explorer-chevron", !open && "closed")}
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
              if (folder) {
                props.onToggle(node.path);
                props.onSelect(node.path);
              } else props.onSelect(node.path);
            }}
          >
            {node.name}
          </button>
        </div>
      </li>
      {folder && open
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
    <span className={cn("explorer-mark", kind)} aria-hidden>
      <FileIcon />
    </span>
  );
}

function parentOf(path: string | null): string {
  if (!path) return "";
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "" : path.slice(0, cut);
}

function saveLocalFile(file: File, path: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = path.split("/").pop() || file.name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
