import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import {
  type ComputerTreeNode,
  filterComputerTree,
  nestComputerEntries,
} from "../lib/computer-tree";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

const CRONS = [
  { label: "Every day at 9:00", value: "0 9 * * *" },
  { label: "Every night at 22:00", value: "0 22 * * *" },
  { label: "Weekdays at 9:00", value: "0 9 * * 1-5" },
] as const;

type Props = NativeStackScreenProps<RootStackParamList, "Computer">;

export function ComputerScreen({ navigation, route }: Props) {
  const { botId } = route.params;
  const queryClient = useQueryClient();
  const botQuery = useQuery(orpc.bots.get.queryOptions({ input: { botId } }));
  const filesQuery = useQuery({
    ...orpc.computer.list.queryOptions({ input: { botId } }),
    refetchInterval: 15_000,
  });
  const routinesQuery = useQuery({
    queryKey: ["routines", botId],
    queryFn: () => client.routines.list({ botId }),
  });
  const [query, setQuery] = useState("");
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cron, setCron] = useState<string>(CRONS[0].value);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tree = useMemo(() => {
    return filterComputerTree(
      nestComputerEntries(filesQuery.data?.entries ?? []),
      query,
    );
  }, [filesQuery.data, query]);

  async function openFile(path: string) {
    setPreviewPath(path);
    setPreview("Loading…");
    try {
      const file = await client.computer.read({ botId, path });
      setPreview(
        file.encoding === "text" && file.content
          ? file.content
          : "(binary file)",
      );
    } catch (caught) {
      setPreview(userFacingError(caught, "Could not read that file."));
    }
  }

  async function createRoutine() {
    if (!name.trim() || !prompt.trim()) return;
    setBusy(true);
    setError("");
    try {
      await client.routines.create({
        botId,
        name: name.trim(),
        prompt: prompt.trim(),
        cron,
      });
      setName("");
      setPrompt("");
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["routines", botId] });
    } catch (caught) {
      setError(userFacingError(caught, "Could not create routine"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Header
        title={`${botQuery.data?.name ?? "Bot"}’s computer`}
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={() => navigation.navigate("BotSettings", { botId })}
          >
            <Text style={styles.link}>Settings</Text>
          </Pressable>
        }
      />
      <Field placeholder="Search files" value={query} onChangeText={setQuery} />
      <Tree nodes={tree} onOpen={openFile} />
      {previewPath ? (
        <View style={styles.preview}>
          <Text style={styles.path}>{previewPath}</Text>
          <Text style={styles.body}>{preview}</Text>
        </View>
      ) : null}
      <Text style={styles.section}>Routines</Text>
      {(routinesQuery.data ?? []).map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.name}>{row.name}</Text>
          <Text style={styles.meta}>{row.cron}</Text>
        </View>
      ))}
      {creating ? (
        <View style={styles.card}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Field label="Name" value={name} onChangeText={setName} />
          <Field
            label="Prompt"
            value={prompt}
            onChangeText={setPrompt}
            multiline
          />
          {CRONS.map((item) => (
            <Pressable key={item.value} onPress={() => setCron(item.value)}>
              <Text style={cron === item.value ? styles.on : styles.meta}>
                {item.label}
              </Text>
            </Pressable>
          ))}
          <Button
            label="Save routine"
            onPress={() => void createRoutine()}
            busy={busy}
          />
        </View>
      ) : (
        <Button
          label="Create routine"
          tone="ghost"
          onPress={() => setCreating(true)}
        />
      )}
    </Screen>
  );
}

function Tree({
  nodes,
  onOpen,
  depth = 0,
}: {
  nodes: ComputerTreeNode[];
  onOpen: (path: string) => void;
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
            style={[styles.file, { paddingLeft: 12 + depth * 14 }]}
          >
            <Text style={styles.fileName}>
              {node.kind === "dir" ? "▸ " : ""}
              {node.name}
            </Text>
          </Pressable>
          {node.children.length > 0 ? (
            <Tree nodes={node.children} onOpen={onOpen} depth={depth + 1} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.accent, fontWeight: "700" },
  section: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
    marginTop: 16,
  },
  file: { paddingVertical: 8 },
  fileName: { color: colors.text },
  preview: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
    gap: 8,
    backgroundColor: colors.surface,
  },
  path: { color: colors.muted, fontSize: 12 },
  body: { color: colors.text, fontFamily: "monospace", fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
    gap: 8,
    backgroundColor: colors.surface,
    marginTop: 8,
  },
  name: { color: colors.text, fontWeight: "700" },
  meta: { color: colors.muted },
  on: { color: colors.accent, fontWeight: "700" },
  error: { color: colors.danger },
});
