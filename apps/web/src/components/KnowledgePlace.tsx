import type { KnowledgeList, KnowledgeSearchHit } from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { bytesToBase64 } from "../lib/computer-attachment";
import { saveComputerDownload } from "../lib/computer-download";
import { computerFileKind } from "../lib/computer-preview";
import { userFacingError } from "../lib/errors";
import {
  indexKnowledgeGraph,
  knowledgeGraphBacklinks,
} from "../lib/knowledge-graph";
import {
  SKILL_IMPORT_PLACEHOLDER,
  skillImportSummary,
} from "../lib/knowledge-import";
import { insertComposerText } from "../lib/knowledge-slash";
import {
  coversKnowledgePath,
  countOfficeSkillHits,
  filterKnowledgeTree,
  findKnowledgeNode,
  isOfficeSkillPath,
  matchingOfficeSkill,
  type KnowledgeTreeNode,
  knowledgeSearchStatus,
  nestKnowledgeTree,
  officeSkillFiles,
  officeSkillFileLabel,
  officeSkillNode,
  officeSkillRows,
  type OfficeSkillFile,
  type OfficeSkillRow,
  rankOfficeSkillRows,
} from "../lib/knowledge-tree";
import { SKILLS_LIBRARY_PATH } from "../lib/office-search";
import {
  knowledgeUploadPath,
  optimisticKnowledgeEntry,
  seedKnowledgePreview,
  upsertKnowledgeEntry,
} from "../lib/knowledge-upload";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { OFFICE_MESSAGES_GC_TIME } from "../lib/office-messages";
import { Button, cn, Field, Input, Textarea } from "../ui";
import {
  CloseIcon,
  DownloadIcon,
  FileKindIcon,
  FolderIcon,
  FolderOpenIcon,
  GraphIcon,
  ImportIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
} from "./Icons";
import { KnowledgeFilePreview } from "./KnowledgeFilePreview";
import { KnowledgeGraphMap } from "./KnowledgeGraph";
import {
  KnowledgeContextMenu,
  type KnowledgeMenuState,
} from "./KnowledgeContextMenu";

type Draft = { path: string; content: string };

const ROOT_COLLAPSED = new Set<string>();

export function KnowledgeLibrary(props: {
  path?: string | null;
  /** Playbook list of this knowledge folder. Same files as the tree. */
  folder?: string | null;
  onPath: (path: string | null) => void;
  onClose: () => void;
}) {
  const workspace = useKnowledgeWorkspace(props.path ?? null);
  const selected = workspace.selected;
  const skillsView = Boolean(props.folder);
  const folder = props.folder || SKILLS_LIBRARY_PATH;
  const selectedNode = selected
    ? findKnowledgeNode(workspace.tree, selected)
    : null;
  const catalog = useMemo(
    () => officeSkillRows(workspace.entries, folder),
    [workspace.entries, folder],
  );
  const skillRows = useMemo(
    () =>
      rankOfficeSkillRows(
        catalog,
        workspace.searchHits,
        workspace.query,
      ),
    [catalog, workspace.query, workspace.searchHits],
  );
  const searchStatus = knowledgeSearchStatus({
    query: workspace.query,
    fetching: workspace.searchBusy,
    hitCount: skillsView
      ? countOfficeSkillHits(catalog, workspace.searchHits)
      : workspace.searchHits.length,
    fallbackCount: skillsView ? skillRows.length : workspace.tree.length,
    kind: skillsView ? "skills" : "library",
  });
  const activeSkill = matchingOfficeSkill(catalog, selected);
  const previewPath =
    selected && workspace.files.has(selected)
      ? selected
      : skillsView
        ? (activeSkill?.path ?? null)
        : null;
  const previewEntry = previewPath
    ? (workspace.entries.find((row) => row.path === previewPath) ?? null)
    : null;
  const skillPack = useMemo(
    () =>
      activeSkill
        ? officeSkillFiles(workspace.entries, activeSkill.directory)
        : [],
    [activeSkill, workspace.entries],
  );
  const [fileMenu, setFileMenu] = useState<KnowledgeMenuState | null>(null);

  useEffect(() => {
    workspace.syncPath(props.path ?? null);
  }, [props.path, workspace.syncPath]);

  function openFileMenu(event: MouseEvent, node: KnowledgeTreeNode) {
    event.preventDefault();
    workspace.pick(node.path);
    props.onPath(node.path);
    setFileMenu({
      node,
      x: event.clientX,
      y: event.clientY,
      phase: "actions",
    });
  }

  function openSkill(row: OfficeSkillRow) {
    workspace.pick(row.path);
    props.onPath(row.path);
  }

  const previewOpen =
    Boolean(previewPath) && workspace.files.has(previewPath ?? "");

  return (
    <div className={cn("knowledge-place", skillsView && "is-skills")}>
      <div className="pane-head">
        <span className="pane-title">{skillsView ? "Skills" : "Knowledge"}</span>
        <div className="row tight">
          {skillsView ? null : (
            <button
              className={cn("icon-btn", workspace.mapOpen && "on")}
              type="button"
              aria-pressed={workspace.mapOpen}
              aria-label="Map"
              title="Map"
              onClick={workspace.toggleMap}
            >
              <GraphIcon />
            </button>
          )}
          <button
            className="icon-btn"
            type="button"
            aria-label="Close"
            title="Close"
            onClick={props.onClose}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="knowledge-split">
        <KnowledgeNav
          kind={skillsView ? "skills" : "library"}
          query={workspace.query}
          onQuery={workspace.setQuery}
          status={searchStatus}
          onNew={() =>
            workspace.startDraft(skillsView ? folder : undefined)
          }
          onUpload={() => workspace.fileRef.current?.click()}
          onImport={workspace.startImport}
          fileRef={workspace.fileRef}
          onFile={workspace.uploadFile}
        >
          {skillsView ? (
            <SkillsList
              pending={
                workspace.listQuery.isPending && workspace.entries.length === 0
              }
              error={workspace.listQuery.error}
              empty={catalog.length === 0 && !workspace.query.trim()}
              searchBusy={workspace.searchBusy}
              rows={skillRows}
              selected={activeSkill?.path ?? null}
              onSelect={openSkill}
              onMenu={(event, row) =>
                openFileMenu(event, officeSkillNode(row))
              }
            />
          ) : (
            <KnowledgeTree
              pending={
                workspace.listQuery.isPending && workspace.entries.length === 0
              }
              error={workspace.listQuery.error}
              empty={workspace.empty}
              truncated={
                workspace.searching
                  ? workspace.searchQuery.data?.truncated
                  : workspace.listQuery.data?.truncated
              }
              tree={workspace.tree}
              hits={workspace.searchHits}
              searching={workspace.searching}
              searchBusy={workspace.searchBusy}
              selected={selected}
              collapsed={
                workspace.searching ? ROOT_COLLAPSED : workspace.collapsed
              }
              onSelect={(path) => {
                workspace.pick(path);
                props.onPath(path);
              }}
              onMenu={openFileMenu}
              onToggle={workspace.toggleCollapsed}
            />
          )}
        </KnowledgeNav>
        <section className="knowledge-preview">
          {workspace.error ? <p className="error">{workspace.error}</p> : null}
          {workspace.draft ? (
            <DraftForm
              draft={workspace.draft}
              busy={workspace.busy}
              title={skillsView ? "New playbook" : "New file"}
              onChange={workspace.setDraft}
              onSave={() => void workspace.saveDraft(props.onPath)}
              onCancel={() => {
                workspace.setDraft(null);
                workspace.syncPath(props.path ?? null);
              }}
            />
          ) : workspace.importing ? (
            <ImportForm
              busy={workspace.busy}
              onImport={(source) =>
                void workspace.importSkill(source, props.onPath)
              }
              onCancel={() => {
                workspace.setImporting(false);
                workspace.syncPath(props.path ?? null);
              }}
            />
          ) : !skillsView && workspace.mapOpen ? (
            <KnowledgeMapPane
              pending={
                workspace.graphQuery.isPending && !workspace.graphQuery.data
              }
              error={workspace.graphQuery.error}
              paths={workspace.graphQuery.data?.paths ?? []}
              out={workspace.graphQuery.data?.out ?? []}
              selected={selected}
              files={workspace.files}
              onSelect={(path) => {
                workspace.highlight(path);
                props.onPath(path);
              }}
              onOpen={(path) => {
                workspace.openPath(path);
                props.onPath(path);
              }}
            />
          ) : previewOpen && previewPath ? (
            <PreviewPane
              path={previewPath}
              title={previewEntry?.title ?? previewPath}
              description={previewEntry?.description ?? ""}
              mediaType={previewEntry?.mediaType}
              localFile={
                workspace.localFiles[previewPath] ?? workspace.localFile
              }
              files={workspace.files}
              pack={skillsView ? skillPack : []}
              packName={skillsView ? activeSkill?.name : undefined}
              backlinks={knowledgeGraphBacklinks(
                workspace.graphIndex,
                previewPath,
              )}
              onOpen={(path) => {
                workspace.openPath(path);
                props.onPath(path);
              }}
              busy={workspace.busy}
              downloading={workspace.downloading}
              onUse={
                isOfficeSkillPath(previewPath)
                  ? () => {
                      insertComposerText(
                        `/skill:${previewEntry?.title || activeSkill?.name || previewPath} `,
                      );
                      props.onClose();
                    }
                  : undefined
              }
              onDownload={() => workspace.downloadPath(previewPath)}
              onRemove={() => {
                const target =
                  skillsView &&
                  activeSkill &&
                  isOfficeSkillPath(previewPath)
                    ? activeSkill.directory || previewPath
                    : previewPath;
                void workspace.removePath(target, props.onPath);
              }}
            />
          ) : !skillsView && selectedNode?.kind === "dir" ? (
            <FolderPane
              node={selectedNode}
              onOpen={(path) => {
                workspace.openPath(path);
                props.onPath(path);
              }}
              onNew={() => workspace.startDraft(selectedNode.path)}
            />
          ) : (
            <KnowledgeEmpty>
              {skillsView
                ? catalog.length === 0
                  ? "No playbooks yet. Import one, or create a new playbook."
                  : "Pick a playbook on the left."
                : selected && !workspace.files.has(selected)
                  ? "A folder. New file or upload lands here."
                  : "Playbooks and notes for this office. Pick one on the left."}
            </KnowledgeEmpty>
          )}
        </section>
      </div>
      <KnowledgeContextMenu
        menu={fileMenu}
        onClose={() => setFileMenu(null)}
        onPhase={setFileMenu}
        onDownload={workspace.downloadPath}
        onCopyPath={(path) => {
          void navigator.clipboard?.writeText(path);
        }}
        onUse={(node) => {
          const name = node.title || node.name;
          insertComposerText(
            isOfficeSkillPath(node.path) ? `/skill:${name} ` : `/${name} `,
          );
          props.onClose();
        }}
        onNewFile={(folder) => {
          setFileMenu(null);
          workspace.startDraft(folder);
        }}
        onDelete={(path) => {
          const skill =
            skillsView ? matchingOfficeSkill(catalog, path) : null;
          const target =
            skill?.directory && isOfficeSkillPath(path)
              ? skill.directory
              : path;
          void workspace.removePath(target, props.onPath);
        }}
      />
    </div>
  );
}

export function KnowledgePeek(props: {
  path: string;
  onPath: (path: string) => void;
  onOpenLibrary: (path: string) => void;
  onClose: () => void;
}) {
  const workspace = useKnowledgeWorkspace(props.path);
  const selected = props.path;
  const entry = workspace.entries.find((row) => row.path === selected) ?? null;
  const canPreview = workspace.files.has(selected);
  const title = entry?.title ?? selected.split("/").filter(Boolean).at(-1) ?? "Knowledge";

  useEffect(() => {
    workspace.syncPath(props.path);
  }, [props.path, workspace.syncPath]);

  function openInside(path: string) {
    if (workspace.files.has(path)) {
      workspace.openPath(path);
      props.onPath(path);
      return;
    }
    props.onOpenLibrary(path);
  }

  return (
    <aside className="pane knowledge-peek">
      <div className="pane-head drag">
        <span className="pane-title">{title}</span>
        <div className="row tight no-drag">
          <button
            className="text-btn"
            type="button"
            onClick={() => props.onOpenLibrary(selected)}
          >
            Library
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="Close"
            title="Close"
            onClick={props.onClose}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="knowledge-peek-body">
        {workspace.error ? <p className="error">{workspace.error}</p> : null}
        {workspace.listQuery.isPending && workspace.entries.length === 0 ? (
          <KnowledgeEmpty>Opening…</KnowledgeEmpty>
        ) : canPreview ? (
          <PreviewPane
            path={selected}
            title={entry?.title ?? selected}
            description={entry?.description ?? ""}
            mediaType={entry?.mediaType}
            localFile={workspace.localFiles[selected] ?? null}
            files={workspace.files}
            backlinks={knowledgeGraphBacklinks(workspace.graphIndex, selected)}
            onOpen={openInside}
            busy={workspace.busy}
            downloading={workspace.downloading}
            onUse={
              isOfficeSkillPath(selected)
                ? () => {
                    insertComposerText(`/skill:${entry?.title || selected} `);
                    props.onClose();
                  }
                : undefined
            }
            onDownload={workspace.downloadSelected}
            onRemove={() =>
              void workspace.removeSelected(() => props.onClose())
            }
          />
        ) : (
          <KnowledgeEmpty>
            {selected
              ? "A folder. Open the library to browse it."
              : "Pick a note in chat, or open the library."}
          </KnowledgeEmpty>
        )}
      </div>
    </aside>
  );
}

function useKnowledgeWorkspace(initialPath: string | null) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const listKey = orpc.knowledge.list.queryOptions().queryKey;
  const graphKey = orpc.knowledge.graph.queryOptions().queryKey;
  const [query, setQuery] = useState("");
  const [searchNeedle, setSearchNeedle] = useState("");
  const [selected, setSelected] = useState<string | null>(initialPath);
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
    gcTime: OFFICE_MESSAGES_GC_TIME,
  });
  const graphQuery = useQuery({
    ...orpc.knowledge.graph.queryOptions(),
    gcTime: OFFICE_MESSAGES_GC_TIME,
  });
  useEffect(() => {
    const needle = query.trim();
    if (!needle) {
      setSearchNeedle("");
      return;
    }
    const timer = window.setTimeout(() => setSearchNeedle(needle), 200);
    return () => window.clearTimeout(timer);
  }, [query]);
  const searchQuery = useQuery({
    ...orpc.knowledge.search.queryOptions({
      input: { query: searchNeedle },
    }),
    enabled: searchNeedle.length > 0,
    placeholderData: (previous) => previous,
    gcTime: OFFICE_MESSAGES_GC_TIME,
  });
  const searchHits = searchNeedle ? (searchQuery.data?.hits ?? []) : [];
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
  const searchBusy =
    searching &&
    (searchNeedle !== query.trim() || searchQuery.isFetching);
  const localFile = selected ? (localFiles[selected] ?? null) : null;
  const empty = !listQuery.isPending && entries.length === 0 && !query.trim();

  const syncPath = useMemo(() => {
    return (path: string | null) => {
      setSelected(path);
      setDraft(null);
      setImporting(false);
      setError("");
    };
  }, []);

  function expandTo(path: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      const parts = path.split("/").filter(Boolean);
      for (let i = 1; i < parts.length; i++) {
        next.delete(parts.slice(0, i).join("/"));
      }
      return next;
    });
  }

  function openPath(path: string) {
    setDraft(null);
    setQuery("");
    setMapOpen(false);
    setImporting(false);
    setSelected(path);
    expandTo(path);
  }

  function pick(path: string) {
    setDraft(null);
    setImporting(false);
    setMapOpen(false);
    setSelected(path);
  }

  function highlight(path: string | null) {
    setSelected(path);
    if (path) expandTo(path);
  }

  async function refresh(path?: string) {
    await queryClient.invalidateQueries({ queryKey: listKey });
    await queryClient.invalidateQueries({ queryKey: graphKey });
    if (searchNeedle) {
      await queryClient.invalidateQueries({
        queryKey: orpc.knowledge.search.queryOptions({
          input: { query: searchNeedle },
        }).queryKey,
      });
    }
    if (path) {
      setSelected(path);
      await queryClient.invalidateQueries({
        queryKey: orpc.knowledge.read.queryOptions({ input: { path } })
          .queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.knowledge.download.queryOptions({ input: { path } })
          .queryKey,
      });
    }
  }

  async function saveDraft(onPath: (path: string | null) => void) {
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
      onPath(saved.path);
    } catch (caught: unknown) {
      setError(userFacingError(caught, "Could not save that"));
    } finally {
      setBusy(false);
    }
  }

  async function importSkill(
    source: string,
    onPath: (path: string | null) => void,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await client.knowledge.importSkill({
        source: source.trim(),
      });
      const summary = skillImportSummary(result);
      if (result.imported.length === 0) {
        setError(summary);
        return;
      }
      setImporting(false);
      const path = result.imported[0]?.path;
      await refresh(path);
      if (path) onPath(path);
    } catch (caught: unknown) {
      setError(userFacingError(caught, "Could not import that skill"));
    } finally {
      setBusy(false);
    }
  }

  async function removePath(
    path: string,
    onGone: (path: string | null) => void,
  ) {
    setBusy(true);
    setError("");
    try {
      await client.knowledge.remove({ path });
      setLocalFiles((current) => {
        const next = { ...current };
        for (const key of Object.keys(next)) {
          if (coversKnowledgePath(path, key)) delete next[key];
        }
        return next;
      });
      const gone = coversKnowledgePath(path, selected);
      if (gone) setSelected(null);
      await refresh();
      if (gone) onGone(null);
    } catch (caught: unknown) {
      setError(userFacingError(caught, "Could not remove that"));
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected(onGone: (path: string | null) => void) {
    if (!selected) return;
    await removePath(selected, onGone);
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
        if (searchNeedle) {
          await queryClient.invalidateQueries({
            queryKey: orpc.knowledge.search.queryOptions({
              input: { query: searchNeedle },
            }).queryKey,
          });
        }
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

  function downloadPath(path: string) {
    if (!path || downloading) return;
    const pending = localFiles[path];
    if (pending) {
      saveLocalFile(pending, path);
      return;
    }
    setDownloading(true);
    setError("");
    void client.knowledge
      .download({ path })
      .then((file) => {
        saveComputerDownload(file);
      })
      .catch((caught: unknown) => {
        setError(userFacingError(caught, "Could not download that file"));
      })
      .finally(() => setDownloading(false));
  }

  function downloadSelected() {
    if (!selected) return;
    downloadPath(selected);
  }

  return {
    fileRef,
    query,
    setQuery,
    selected,
    collapsed,
    draft,
    setDraft,
    importing,
    setImporting,
    mapOpen,
    busy,
    downloading,
    error,
    localFiles,
    listQuery,
    graphQuery,
    searchQuery,
    searchHits,
    graphIndex,
    entries,
    files,
    selectedEntry,
    canPreview,
    tree,
    searching,
    searchBusy,
    localFile,
    empty,
    syncPath,
    openPath,
    pick,
    highlight,
    saveDraft,
    importSkill,
    removePath,
    removeSelected,
    uploadFile,
    downloadPath,
    downloadSelected,
    startDraft: (folder?: string) => {
      const dest =
        folder ??
        (selected && !files.has(selected) ? selected : parentOf(selected));
      setImporting(false);
      setMapOpen(false);
      setDraft({
        path: dest ? `${dest}/` : "skills/",
        content: "",
      });
      setSelected(null);
    },
    startImport: () => {
      setDraft(null);
      setError("");
      setMapOpen(false);
      setImporting(true);
    },
    toggleMap: () => {
      setDraft(null);
      setImporting(false);
      setError("");
      setMapOpen((open) => !open);
    },
    toggleCollapsed: (path: string) => {
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    },
  };
}

function KnowledgeEmpty(props: { children: ReactNode }) {
  return (
    <div className="knowledge-empty">
      <p>{props.children}</p>
    </div>
  );
}

function FolderPane(props: {
  node: KnowledgeTreeNode;
  onOpen: (path: string) => void;
  onNew: () => void;
}) {
  const children = props.node.children;
  return (
    <div className="knowledge-folder">
      <div className="knowledge-preview-head">
        <div>
          <KnowledgePath path={props.node.path} onOpen={props.onOpen} />
        </div>
        <button className="text-btn" type="button" onClick={props.onNew}>
          New file
        </button>
      </div>
      {children.length === 0 ? (
        <KnowledgeEmpty>Nothing in this folder yet.</KnowledgeEmpty>
      ) : (
        <ul className="knowledge-folder-list">
          {children.map((child) => (
            <li key={child.path}>
              <button
                type="button"
                className="knowledge-folder-item"
                onClick={() => props.onOpen(child.path)}
              >
                <span className="knowledge-folder-name">{child.name}</span>
                {child.kind === "file" && child.description ? (
                  <span className="knowledge-folder-desc">
                    {child.description}
                  </span>
                ) : child.kind === "dir" ? (
                  <span className="knowledge-folder-desc">Folder</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KnowledgeNav(props: {
  kind?: "library" | "skills";
  query: string;
  onQuery: (query: string) => void;
  status?: { label: string; busy: boolean } | null;
  onNew: () => void;
  onUpload: () => void;
  onImport: () => void;
  fileRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  children: ReactNode;
}) {
  const skills = props.kind === "skills";
  const status = props.status;
  return (
    <aside className="knowledge-nav">
      <div className="knowledge-nav-tools">
        <label
          className={cn(
            "search-field explorer-search",
            status?.busy && "is-busy",
          )}
        >
          <SearchIcon />
          <input
            value={props.query}
            onChange={(event) => props.onQuery(event.target.value)}
            placeholder={skills ? "Search playbooks…" : "Search notes…"}
            aria-label={skills ? "Search playbooks" : "Search knowledge"}
            aria-busy={status?.busy ?? false}
          />
        </label>
        {status ? (
          <p className="knowledge-search-status" aria-live="polite">
            {status.label}
          </p>
        ) : null}
        <div className="knowledge-adds">
          <button
            className="icon-btn"
            type="button"
            aria-label={skills ? "New playbook" : "New file"}
            title={skills ? "New playbook" : "New file"}
            onClick={props.onNew}
          >
            <PlusIcon />
          </button>
          {skills ? null : (
            <button
              className="icon-btn"
              type="button"
              aria-label="Upload"
              title="Upload"
              onClick={props.onUpload}
            >
              <UploadIcon />
            </button>
          )}
          <button
            className="icon-btn"
            type="button"
            aria-label="Import playbook"
            title="Import playbook"
            onClick={props.onImport}
          >
            <ImportIcon />
          </button>
          <input
            ref={props.fileRef}
            className="hidden"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) props.onFile(file);
            }}
          />
        </div>
      </div>
      <div
        className={cn("explorer", skills ? "skills-nav" : "knowledge-tree")}
      >
        {props.children}
      </div>
    </aside>
  );
}

function SkillsList(props: {
  pending: boolean;
  error: Error | null;
  empty: boolean;
  searchBusy: boolean;
  rows: OfficeSkillRow[];
  selected: string | null;
  onSelect: (row: OfficeSkillRow) => void;
  onMenu: (event: MouseEvent, row: OfficeSkillRow) => void;
}) {
  if (props.pending) return <p className="explorer-empty">Opening…</p>;
  if (props.error) {
    return (
      <p className="explorer-empty">
        {userFacingError(props.error, "Could not read skills")}
      </p>
    );
  }
  if (props.empty) {
    return (
      <p className="explorer-empty">
        Nothing here yet. New or import a playbook.
      </p>
    );
  }
  if (props.rows.length === 0) {
    return (
      <p className="explorer-empty">
        {props.searchBusy ? "Searching playbooks…" : "No matching playbooks."}
      </p>
    );
  }
  return (
    <ul className="skills-list">
      {props.rows.map((row) => {
        const on = props.selected === row.path;
        return (
          <li key={row.path}>
            <div
              className={cn("skills-row", on && "on")}
              onContextMenu={(event) => props.onMenu(event, row)}
            >
              <button
                className="skills-row-main"
                type="button"
                onClick={() => props.onSelect(row)}
              >
                <span className="skills-row-name">/{row.name}</span>
                {row.description ? (
                  <span className="skills-row-desc">{row.description}</span>
                ) : null}
                {row.pack ? (
                  <span className="skills-row-meta">{row.pack}</span>
                ) : null}
              </button>
              <button
                className="explorer-more"
                type="button"
                aria-label={`${row.name} actions`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  props.onMenu(event, row);
                }}
              >
                <MoreIcon />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function KnowledgeTree(props: {
  pending: boolean;
  error: Error | null;
  empty: boolean;
  truncated?: boolean;
  tree: KnowledgeTreeNode[];
  hits: KnowledgeSearchHit[];
  searching: boolean;
  searchBusy: boolean;
  selected: string | null;
  collapsed: Set<string>;
  onSelect: (path: string) => void;
  onMenu: (event: MouseEvent, node: KnowledgeTreeNode) => void;
  onToggle: (path: string) => void;
}) {
  if (props.pending) return <p className="explorer-empty">Opening…</p>;
  if (props.error) {
    return (
      <p className="explorer-empty">
        {userFacingError(props.error, "Could not read knowledge")}
      </p>
    );
  }
  if (props.empty) {
    return (
      <p className="explorer-empty">
        Nothing here yet. New, upload, or import a playbook.
      </p>
    );
  }
  if (
    props.searching &&
    props.hits.length === 0 &&
    props.searchBusy &&
    props.tree.length === 0
  ) {
    return <p className="explorer-empty">Searching notes…</p>;
  }
  if (props.searching && props.hits.length > 0) {
    return (
      <>
        <ul className="knowledge-hits">
          {props.hits.map((hit) => {
            const on = props.selected === hit.path;
            const name =
              hit.title.trim() ||
              hit.path.split("/").filter(Boolean).at(-1) ||
              hit.path;
            return (
              <li key={hit.path}>
                <button
                  type="button"
                  className={cn("knowledge-hit", on && "on")}
                  onClick={() => props.onSelect(hit.path)}
                >
                  <span className="knowledge-hit-title">{name}</span>
                  <span className="knowledge-hit-path">{hit.path}</span>
                  {hit.snippet ? (
                    <span className="knowledge-hit-snippet">{hit.snippet}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {props.truncated ? (
          <p className="explorer-empty">Showing the first 800 files.</p>
        ) : null}
      </>
    );
  }
  if (props.searching && props.tree.length === 0) {
    return <p className="explorer-empty">No matching notes.</p>;
  }
  return (
    <>
      <ul className="explorer-tree">
        {props.tree.map((node) => (
          <TreeRows
            key={node.path}
            node={node}
            depth={0}
            selected={props.selected}
            collapsed={props.collapsed}
            onSelect={props.onSelect}
            onMenu={props.onMenu}
            onToggle={props.onToggle}
          />
        ))}
      </ul>
      {props.truncated ? (
        <p className="explorer-empty">Showing the first 800 files.</p>
      ) : null}
    </>
  );
}

function KnowledgeMapPane(props: {
  pending: boolean;
  error: Error | null;
  paths: string[];
  out: number[][];
  selected: string | null;
  files: ReadonlySet<string>;
  onSelect: (path: string | null) => void;
  onOpen: (path: string) => void;
}) {
  if (props.pending) {
    return <KnowledgeEmpty>Opening map…</KnowledgeEmpty>;
  }
  if (props.error) {
    return (
      <KnowledgeEmpty>
        {userFacingError(props.error, "Could not load the map")}
      </KnowledgeEmpty>
    );
  }
  return (
    <KnowledgeGraphMap
      paths={props.paths}
      out={props.out}
      selected={props.selected}
      files={props.files}
      onSelect={props.onSelect}
      onOpen={props.onOpen}
    />
  );
}

function PreviewPane(props: {
  path: string;
  title: string;
  description: string;
  mediaType?: string;
  localFile?: File | null;
  files: ReadonlySet<string>;
  pack?: OfficeSkillFile[];
  packName?: string;
  backlinks: string[];
  onOpen: (path: string) => void;
  busy: boolean;
  downloading: boolean;
  onUse?: () => void;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const skill = isOfficeSkillPath(props.path);
  const pack = props.pack ?? [];
  const currentPack = pack.find((file) => file.path === props.path);
  const markdown =
    computerFileKind(props.path) === "md" ||
    props.mediaType === "text/markdown";
  return (
    <>
      <div className="knowledge-preview-head">
        <div>
          {props.packName ? (
            <>
              <p className="knowledge-kicker">/{props.packName}</p>
              {currentPack && !skill ? (
                <p className="knowledge-kicker">{currentPack.name}</p>
              ) : null}
            </>
          ) : skill ? (
            <p className="knowledge-kicker">/{props.title}</p>
          ) : (
            <KnowledgePath path={props.path} onOpen={props.onOpen} />
          )}
          {markdown ? null : <h3>{props.title}</h3>}
          {props.description ? (
            <p className="muted knowledge-preview-desc">{props.description}</p>
          ) : null}
          {pack.length > 1 ? (
            <div
              className="skill-files"
              role="tablist"
              aria-label="Files in this skill"
            >
              {pack.map((file) => {
                const on = file.path === props.path;
                return (
                  <button
                    key={file.path}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    className={cn("skill-file", on && "on")}
                    onClick={() => props.onOpen(file.path)}
                  >
                    {officeSkillFileLabel(file)}
                  </button>
                );
              })}
            </div>
          ) : null}
          <KnowledgeBacklinks sources={props.backlinks} onOpen={props.onOpen} />
        </div>
        <div className="row tight">
          {props.onUse ? (
            <button className="text-btn" type="button" onClick={props.onUse}>
              Use in chat
            </button>
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

function KnowledgePath(props: {
  path: string;
  onOpen: (path: string) => void;
}) {
  const parts = props.path.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className="knowledge-kicker">
      {parts.map((part, index) => {
        const prefix = parts.slice(0, index + 1).join("/");
        const last = index === parts.length - 1;
        return (
          <span key={prefix}>
            {index > 0 ? (
              <span className="knowledge-path-sep" aria-hidden>
                /
              </span>
            ) : null}
            {last ? (
              <span>{part}</span>
            ) : (
              <button
                type="button"
                className="knowledge-path-seg"
                onClick={() => props.onOpen(prefix)}
              >
                {part}
              </button>
            )}
          </span>
        );
      })}
    </p>
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
  title?: string;
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
      <h3>{props.title ?? "New file"}</h3>
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
  onMenu: (event: MouseEvent, node: KnowledgeTreeNode) => void;
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
          onContextMenu={(event) => props.onMenu(event, node)}
        >
          {folder ? (
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
            onClick={() => {
              if (folder) {
                props.onToggle(node.path);
                props.onSelect(node.path);
              } else props.onSelect(node.path);
            }}
          >
            {node.name}
          </button>
          <button
            className="explorer-more"
            type="button"
            aria-label={`${node.name} actions`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              props.onMenu(event, node);
            }}
          >
            <MoreIcon />
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
              onMenu={props.onMenu}
              onToggle={props.onToggle}
            />
          ))
        : null}
    </>
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
