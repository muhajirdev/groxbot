import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { ChatMarkdown } from "../components/ChatMarkdown";
import { Field } from "../components/Field";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { bytesToBase64 } from "../lib/computer-attachment";
import { downloadDataUri } from "../lib/computer-download";
import {
  computerPreviewKind,
  computerPreviewSource,
} from "../lib/computer-preview";
import { userFacingError } from "../lib/errors";
import {
  graphNodeLabel,
  indexKnowledgeGraph,
  knowledgeGraphBacklinks,
  knowledgeGraphOutgoing,
} from "../lib/knowledge-graph";
import {
  SKILL_IMPORT_PLACEHOLDER,
  skillImportSummary,
} from "../lib/knowledge-import";
import {
  filterKnowledgeTree,
  type KnowledgeTreeNode,
  nestKnowledgeTree,
} from "../lib/knowledge-tree";
import { knowledgeUploadPath } from "../lib/knowledge-upload";
import { orpc } from "../lib/orpc";
import { pickOfficeFiles } from "../lib/pick-file";
import { client } from "../lib/rpc";
import { shareComputerDownload } from "../lib/share-file";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Knowledge">;

export function KnowledgeScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const listQuery = useQuery(orpc.knowledge.list.queryOptions());
  const graphQuery = useQuery(orpc.knowledge.graph.queryOptions());
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"library" | "graph">("library");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [path, setPath] = useState("");
  const [previewKind, setPreviewKind] = useState<
    "text" | "image" | "binary" | "empty"
  >("empty");
  const [imageUri, setImageUri] = useState("");
  const [importSource, setImportSource] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const tree = useMemo(
    () =>
      filterKnowledgeTree(
        nestKnowledgeTree(listQuery.data?.entries ?? []),
        query,
      ),
    [listQuery.data, query],
  );
  const graphIndex = useMemo(
    () =>
      indexKnowledgeGraph({
        paths: graphQuery.data?.paths ?? [],
        out: graphQuery.data?.out ?? [],
      }),
    [graphQuery.data],
  );
  const backlinks = selected
    ? knowledgeGraphBacklinks(graphIndex, selected)
    : [];
  const outgoing = selected ? knowledgeGraphOutgoing(graphIndex, selected) : [];
  const files = useMemo(
    () => new Set((listQuery.data?.entries ?? []).map((row) => row.path)),
    [listQuery.data],
  );

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: orpc.knowledge.list.key(),
    });
    await queryClient.invalidateQueries({
      queryKey: orpc.knowledge.graph.key(),
    });
  }

  async function openFile(nextPath: string) {
    setSelected(nextPath);
    setPath(nextPath);
    setError("");
    setNotice("");
    setTab("library");
    const entry = listQuery.data?.entries.find((row) => row.path === nextPath);
    const kind = computerPreviewKind(nextPath, entry?.mediaType ?? "");
    const source = computerPreviewSource(kind);
    try {
      if (source === "download" || kind === "image") {
        const file = await client.knowledge.download({ path: nextPath });
        if (kind === "image") {
          setPreviewKind("image");
          setImageUri(downloadDataUri(file));
          setDraft("");
          return;
        }
        setPreviewKind("binary");
        setDraft("");
        setImageUri("");
        return;
      }
      const file = await client.knowledge.read({ path: nextPath });
      const text = file.encoding === "text" ? file.content : "";
      setDraft(text);
      setPreviewKind(text ? "text" : "binary");
      setImageUri("");
    } catch (caught) {
      setError(userFacingError(caught, "Could not read that file."));
      setPreviewKind("empty");
    }
  }

  async function save() {
    if (!path.trim()) return;
    setBusy(true);
    setError("");
    try {
      await client.knowledge.write({ path: path.trim(), content: draft });
      await refresh();
      setSelected(path.trim());
      setPreviewKind("text");
    } catch (caught) {
      setError(userFacingError(caught, "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  async function importSkill() {
    if (!importSource.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await client.knowledge.importSkill({
        source: importSource.trim(),
      });
      const summary = skillImportSummary(result);
      if (result.imported.length === 0) {
        setError(summary);
        return;
      }
      setImportSource("");
      setNotice(summary);
      await refresh();
      const first = result.imported[0]?.path;
      if (first) await openFile(first);
    } catch (caught) {
      setError(userFacingError(caught, "Could not import skill"));
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
      setSelected(null);
      setDraft("");
      setPreviewKind("empty");
      await refresh();
    } catch (caught) {
      setError(userFacingError(caught, "Could not remove"));
    } finally {
      setBusy(false);
    }
  }

  async function downloadSelected() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const file = await client.knowledge.download({ path: selected });
      await shareComputerDownload(file);
    } catch (caught) {
      setError(userFacingError(caught, "Could not download that file"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles() {
    setBusy(true);
    setError("");
    try {
      const folder =
        selected && !files.has(selected) ? selected : parentOf(selected);
      const picked = await pickOfficeFiles(0);
      for (const file of picked) {
        const nextPath = knowledgeUploadPath(folder, file.name);
        const bytes = new Uint8Array(await file.arrayBuffer());
        await client.knowledge.write({
          path: nextPath,
          content: bytesToBase64(bytes),
          encoding: "base64",
          mediaType: file.type || undefined,
        });
        setSelected(nextPath);
      }
      await refresh();
    } catch (caught) {
      setError(userFacingError(caught, "Could not add that file"));
    } finally {
      setBusy(false);
    }
  }

  function toggleDir(dirPath: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  }

  return (
    <Screen scroll>
      <Header title="Knowledge" onBack={() => navigation.goBack()} />
      <Text style={styles.body}>
        Office library. A SKILL.md anywhere is a playbook.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("library")} style={styles.tab}>
          <Text style={tab === "library" ? styles.on : styles.meta}>
            Library
          </Text>
        </Pressable>
        <Pressable onPress={() => setTab("graph")} style={styles.tab}>
          <Text style={tab === "graph" ? styles.on : styles.meta}>Graph</Text>
        </Pressable>
      </View>
      <Field placeholder="Search" value={query} onChangeText={setQuery} />
      {tab === "graph" ? (
        <GraphList
          index={graphIndex}
          query={query}
          selected={selected}
          onOpen={(next) => void openFile(next)}
        />
      ) : (
        <Tree
          nodes={tree}
          onOpen={(next) => void openFile(next)}
          onToggle={toggleDir}
          selected={selected}
          collapsed={collapsed}
          searching={query.trim().length > 0}
        />
      )}
      {selected ? (
        <View style={styles.card}>
          <Text style={styles.path}>{selected}</Text>
          {previewKind === "image" && imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              accessibilityLabel={selected}
            />
          ) : previewKind === "text" ? (
            <>
              <ChatMarkdown
                text={draft}
                officePaths
                onOpenPath={(next) => void openFile(next)}
              />
              <Field value={draft} onChangeText={setDraft} multiline />
              <Button label="Save" onPress={() => void save()} busy={busy} />
            </>
          ) : (
            <Text style={styles.body}>Binary file — download to open.</Text>
          )}
          {backlinks.length > 0 ? (
            <View>
              <Text style={styles.section}>Backlinks</Text>
              {backlinks.map((link) => (
                <Pressable key={link} onPress={() => void openFile(link)}>
                  <Text style={styles.link}>{link}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {outgoing.length > 0 ? (
            <View>
              <Text style={styles.section}>Links out</Text>
              {outgoing.map((link) => (
                <Pressable key={link} onPress={() => void openFile(link)}>
                  <Text style={styles.link}>{link}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Button
            label="Download"
            tone="ghost"
            onPress={() => void downloadSelected()}
            busy={busy}
          />
          <Button
            label="Remove"
            tone="danger"
            onPress={() => void removeSelected()}
            busy={busy}
          />
        </View>
      ) : null}
      <Button
        label="Upload a file"
        tone="ghost"
        onPress={() => void uploadFiles()}
        busy={busy}
      />
      <Text style={styles.section}>New file</Text>
      <Field
        label="Path"
        value={path}
        onChangeText={setPath}
        placeholder="playbooks/SKILL.md"
      />
      <Field label="Contents" value={draft} onChangeText={setDraft} multiline />
      <Button label="Write" onPress={() => void save()} busy={busy} />
      <Text style={styles.section}>Import a skill</Text>
      <Field
        label="URL or gist"
        value={importSource}
        onChangeText={setImportSource}
        placeholder={SKILL_IMPORT_PLACEHOLDER}
        keyboardType="url"
      />
      <Button
        label="Import"
        tone="ghost"
        onPress={() => void importSkill()}
        busy={busy}
      />
    </Screen>
  );
}

function GraphList(props: {
  index: ReturnType<typeof indexKnowledgeGraph>;
  query: string;
  selected: string | null;
  onOpen: (path: string) => void;
}) {
  const needle = props.query.trim().toLowerCase();
  const rows = props.index.paths.filter((path) =>
    needle ? path.toLowerCase().includes(needle) : true,
  );
  if (rows.length === 0) {
    return <Text style={styles.body}>No linked notes yet.</Text>;
  }
  return (
    <View>
      {rows.map((path) => {
        const ins = knowledgeGraphBacklinks(props.index, path).length;
        const outs = knowledgeGraphOutgoing(props.index, path).length;
        return (
          <Pressable
            key={path}
            onPress={() => props.onOpen(path)}
            style={styles.file}
          >
            <Text style={props.selected === path ? styles.on : styles.fileName}>
              {graphNodeLabel(path)}
            </Text>
            <Text style={styles.meta}>
              {ins} in · {outs} out · {path}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Tree({
  nodes,
  onOpen,
  onToggle,
  selected,
  collapsed,
  searching,
  depth = 0,
}: {
  nodes: KnowledgeTreeNode[];
  onOpen: (path: string) => void;
  onToggle: (path: string) => void;
  selected: string | null;
  collapsed: Set<string>;
  searching: boolean;
  depth?: number;
}) {
  return (
    <View>
      {nodes.map((node) => {
        const open = searching || !collapsed.has(node.path);
        return (
          <View key={node.path}>
            <Pressable
              onPress={() => {
                if (node.kind === "file") onOpen(node.path);
                else onToggle(node.path);
              }}
              style={[styles.file, { paddingLeft: 8 + depth * 14 }]}
            >
              <Text
                style={selected === node.path ? styles.on : styles.fileName}
              >
                {node.kind === "dir" ? (open ? "▾ " : "▸ ") : ""}
                {node.title || node.name}
              </Text>
            </Pressable>
            {node.children.length > 0 && open ? (
              <Tree
                nodes={node.children}
                onOpen={onOpen}
                onToggle={onToggle}
                selected={selected}
                collapsed={collapsed}
                searching={searching}
                depth={depth + 1}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function parentOf(path: string | null): string {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  return parts.slice(0, -1).join("/");
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  error: { color: colors.danger },
  notice: { color: colors.accent },
  tabs: { flexDirection: "row", gap: 16 },
  tab: { paddingVertical: 4 },
  file: { paddingVertical: 8 },
  fileName: { color: colors.text },
  on: { color: colors.accent, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  section: { color: colors.text, fontWeight: "700", marginTop: 8 },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
    gap: 8,
    backgroundColor: colors.surface,
  },
  path: { color: colors.muted, fontSize: 12 },
  link: { color: colors.accent, fontWeight: "600", paddingVertical: 4 },
  image: { width: "100%", height: 220, borderRadius: 10 },
});
