import type { PluginConnection } from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { loadPluginCatalog, type PluginCard } from "../lib/plugins";
import { client } from "../lib/rpc";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Plugins">;

export function PluginsScreen({ navigation, route }: Props) {
  const botId = route.params?.botId;
  const queryClient = useQueryClient();
  const connectionsQuery = useQuery(orpc.plugins.list.queryOptions());
  const mcpQuery = useQuery(orpc.mcp.list.queryOptions());
  const [catalog, setCatalog] = useState<PluginCard[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"market" | "yours">("market");
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void loadPluginCatalog().then(setCatalog);
  }, []);

  const byToolkit = useMemo(() => {
    const map = new Map<string, PluginConnection>();
    for (const row of connectionsQuery.data ?? []) map.set(row.toolkit, row);
    return map;
  }, [connectionsQuery.data]);

  const visible = catalog.filter((item) => {
    const q = query.trim().toLowerCase();
    if (q && !item.name.toLowerCase().includes(q) && !item.id.includes(q)) {
      return false;
    }
    if (tab === "yours") return byToolkit.has(item.id);
    return true;
  });

  async function addOrRemove(item: PluginCard) {
    setError("");
    setBusy(item.id);
    try {
      if (byToolkit.has(item.id)) {
        await client.plugins.remove({
          toolkit: item.id as PluginConnection["toolkit"],
        });
      } else {
        await client.plugins.add({
          toolkit: item.id as PluginConnection["toolkit"],
        });
      }
      await queryClient.invalidateQueries({
        queryKey: orpc.plugins.list.key(),
      });
    } catch (caught) {
      setError(userFacingError(caught, "Could not update plugin"));
    } finally {
      setBusy(null);
    }
  }

  async function authenticate(item: PluginCard) {
    setError("");
    setBusy(item.id);
    try {
      const result = await client.plugins.connect({
        toolkit: item.id as PluginConnection["toolkit"],
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.plugins.list.key(),
      });
      if (result.redirectUrl) {
        await WebBrowser.openBrowserAsync(result.redirectUrl);
        await client.plugins.refresh();
        await queryClient.invalidateQueries({
          queryKey: orpc.plugins.list.key(),
        });
      }
    } catch (caught) {
      setError(userFacingError(caught, "Could not connect plugin"));
    } finally {
      setBusy(null);
    }
  }

  async function addRemoteMcp() {
    if (!botId) {
      setError("Open a teammate first, then connect this MCP.");
      return;
    }
    const name = mcpName.trim();
    const url = mcpUrl.trim();
    if (!name || !url) return;
    setBusy("mcp-add");
    setError("");
    try {
      const result = await client.mcp.add({ botId, name, url });
      setMcpName("");
      setMcpUrl("");
      await queryClient.invalidateQueries({ queryKey: orpc.mcp.list.key() });
      if (result.redirectUrl) {
        await WebBrowser.openBrowserAsync(result.redirectUrl);
      }
    } catch (caught) {
      setError(userFacingError(caught, "Could not add MCP"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen scroll>
      <Header title="Plugins" onBack={() => navigation.goBack()} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("market")}>
          <Text style={tab === "market" ? styles.on : styles.meta}>Market</Text>
        </Pressable>
        <Pressable onPress={() => setTab("yours")}>
          <Text style={tab === "yours" ? styles.on : styles.meta}>Yours</Text>
        </Pressable>
      </View>
      <Field placeholder="Search" value={query} onChangeText={setQuery} />
      {visible.slice(0, 40).map((item) => {
        const connected = byToolkit.get(item.id);
        return (
          <View key={item.id} style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            {item.blurb ? (
              <Text style={styles.body} numberOfLines={2}>
                {item.blurb}
              </Text>
            ) : null}
            <View style={styles.row}>
              <Button
                label={connected ? "Remove" : "Add"}
                tone="ghost"
                busy={busy === item.id}
                onPress={() => void addOrRemove(item)}
              />
              {connected ? (
                <Button
                  label="Connect"
                  busy={busy === item.id}
                  onPress={() => void authenticate(item)}
                />
              ) : null}
            </View>
          </View>
        );
      })}
      <Text style={styles.section}>Remote MCP</Text>
      <Field label="Name" value={mcpName} onChangeText={setMcpName} />
      <Field
        label="URL"
        value={mcpUrl}
        onChangeText={setMcpUrl}
        keyboardType="url"
      />
      <Button
        label="Add MCP"
        onPress={() => void addRemoteMcp()}
        busy={busy === "mcp-add"}
      />
      {(mcpQuery.data ?? []).map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.name}>{row.name}</Text>
          <Text style={styles.meta}>{row.url}</Text>
          <Button
            label="Remove"
            tone="danger"
            onPress={() => {
              void client.mcp.remove({ id: row.id }).then(() =>
                queryClient.invalidateQueries({
                  queryKey: orpc.mcp.list.key(),
                }),
              );
            }}
          />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger },
  tabs: { flexDirection: "row", gap: 16 },
  on: { color: colors.accent, fontWeight: "700" },
  meta: { color: colors.muted },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
    backgroundColor: colors.surface,
  },
  name: { color: colors.text, fontWeight: "700" },
  body: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: "row", gap: 8 },
  section: { color: colors.text, fontWeight: "700", marginTop: 12 },
});
