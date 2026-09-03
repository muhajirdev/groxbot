import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import {
  filterKnowledgeTree,
  type KnowledgeTreeNode,
  nestKnowledgeTree,
} from "../lib/knowledge-tree";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Knowledge">;

export function KnowledgeScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const listQuery = useQuery(orpc.knowledge.list.queryOptions());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const [draft, setDraft] = useState("");
  const [path, setPath] = useState("");
  const [importSource, setImportSource] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tree = useMemo(
    () =>
      filterKnowledgeTree(
        nestKnowledgeTree(listQuery.data?.entries ?? []),
        query,
      ),
    [listQuery.data, query],
  );

  async function openFile(nextPath: string) {
    setSelected(nextPath);
    setError("");
    try {
      const file = await client.knowledge.read({ path: nextPath });
      const text = file.encoding === "text" ? file.content : "(binary file)";
      setPreview(text);
      setDraft(text);
      setPath(nextPath);
    } catch (caught) {
      setError(userFacingError(caught, "Could not read that file."));
    }
  }

  async function save() {
    if (!path.trim()) return;
    setBusy(true);
    setError("");
    try {
      await client.knowledge.write({ path: path.trim(), content: draft });
      await queryClient.invalidateQueries({
        queryKey: orpc.knowledge.list.key(),
      });
      setPreview(draft);
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
    try {
      await client.knowledge.importSkill({ source: importSource.trim() });
      setImportSource("");
      await queryClient.invalidateQueries({
        queryKey: orpc.knowledge.list.key(),
      });
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
      setPreview("");
      setDraft("");
      await queryClient.invalidateQueries({
        queryKey: orpc.knowledge.list.key(),
      });
    } catch (caught) {
      setError(userFacingError(caught, "Could not remove"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Header title="Knowledge" onBack={() => navigation.goBack()} />
      <Text style={styles.body}>
        Office library. A SKILL.md anywhere is a playbook.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Field placeholder="Search" value={query} onChangeText={setQuery} />
      <Tree nodes={tree} onOpen={openFile} selected={selected} />
      {selected ? (
        <View style={styles.card}>
          <Text style={styles.path}>{selected}</Text>
          <Field value={draft} onChangeText={setDraft} multiline />
          <Button label="Save" onPress={() => void save()} busy={busy} />
          <Button
            label="Remove"
            tone="danger"
            onPress={() => void removeSelected()}
            busy={busy}
          />
        </View>
      ) : preview ? (
        <Text style={styles.body}>{preview}</Text>
      ) : null}
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

function Tree({
  nodes,
  onOpen,
  selected,
  depth = 0,
}: {
  nodes: KnowledgeTreeNode[];
  onOpen: (path: string) => void;
  selected: string | null;
  depth?: number;
}) {
  return (
    <View>
      {nodes.map((node) => (
        <View key={node.path}>
          <Pressable
            onPress={() => {
              if (node.kind === "file") onOpen(node.path);
            }}
            style={[styles.file, { paddingLeft: 8 + depth * 14 }]}
          >
            <Text style={selected === node.path ? styles.on : styles.fileName}>
              {node.kind === "dir" ? "▸ " : ""}
              {node.title || node.name}
            </Text>
          </Pressable>
          {node.children.length > 0 ? (
            <Tree
              nodes={node.children}
              onOpen={onOpen}
              selected={selected}
              depth={depth + 1}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  error: { color: colors.danger },
  file: { paddingVertical: 8 },
  fileName: { color: colors.text },
  on: { color: colors.accent, fontWeight: "700" },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
    gap: 8,
    backgroundColor: colors.surface,
  },
  path: { color: colors.muted, fontSize: 12 },
  section: { color: colors.text, fontWeight: "700", marginTop: 12 },
});
