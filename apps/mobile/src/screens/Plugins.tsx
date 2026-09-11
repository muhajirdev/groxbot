import type { McpProbeResult, PluginConnection } from "@groxbot/contracts";
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
type Tab = "search" | "installed";

function mcpHostLabel(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function pluginAccountDetail(row: PluginConnection): string {
  const scope = row.visibility === "private" ? "Private" : "Shared";
  if (row.status === "error" && row.lastError?.trim()) return row.lastError;
  if (row.status === "connecting") return `${scope} · Connecting`;
  if (row.status === "added") return `${scope} · Not authenticated`;
  if (row.status === "connected") return `${scope} · Connected`;
  return scope;
}

export function PluginsScreen({ navigation, route }: Props) {
  const botId = route.params?.botId;
  const queryClient = useQueryClient();
  const meQuery = useQuery(orpc.me.queryOptions());
  const connectionsQuery = useQuery(orpc.plugins.list.queryOptions());
  const mcpQuery = useQuery(orpc.mcp.list.queryOptions());
  const [catalog, setCatalog] = useState<PluginCard[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("search");
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpBearer, setMcpBearer] = useState("");
  const [probes, setProbes] = useState<Record<string, McpProbeResult>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const meUserId = meQuery.data?.userId;

  useEffect(() => {
    void loadPluginCatalog().then(setCatalog);
  }, []);

  const catalogNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of catalog) map.set(item.id, item.name);
    return map;
  }, [catalog]);
  const connections = connectionsQuery.data ?? [];

  const q = query.trim().toLowerCase();
  const visible = catalog.filter((item) => {
    if (q && !item.name.toLowerCase().includes(q) && !item.id.includes(q)) {
      return false;
    }
    return true;
  });
  const pluginAccounts = connections.filter((row) => {
    const name = catalogNames.get(row.toolkit) ?? row.toolkit;
    if (!q) return true;
    return name.toLowerCase().includes(q) || row.toolkit.includes(q);
  });

  const mcpRows = (mcpQuery.data ?? []).filter((row) => {
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) || row.url.toLowerCase().includes(q)
    );
  });

  async function refreshPlugins() {
    await queryClient.invalidateQueries({
      queryKey: orpc.plugins.list.key(),
    });
  }

  async function authenticate(id: string, busyKey = id) {
    setError("");
    setBusy(busyKey);
    try {
      const result = await client.plugins.connect({ id });
      await refreshPlugins();
      if (result.redirectUrl) {
        await WebBrowser.openBrowserAsync(result.redirectUrl);
        await client.plugins.refresh();
        await refreshPlugins();
      }
    } catch (caught) {
      setError(userFacingError(caught, "Could not connect plugin"));
    } finally {
      setBusy(null);
    }
  }

  async function addAccount(item: PluginCard) {
    setError("");
    setBusy(item.id);
    try {
      const row = await client.plugins.add({
        toolkit: item.id as PluginConnection["toolkit"],
      });
      await refreshPlugins();
      await authenticate(row.id, item.id);
    } catch (caught) {
      setError(userFacingError(caught, "Could not add plugin"));
      setBusy(null);
    }
  }

  async function removePluginAccount(id: string) {
    setError("");
    setBusy(id);
    try {
      await client.plugins.remove({ id });
      await refreshPlugins();
    } catch (caught) {
      setError(userFacingError(caught, "Could not remove plugin"));
    } finally {
      setBusy(null);
    }
  }

  async function sharePluginAccount(row: PluginConnection) {
    const visibility = row.visibility === "shared" ? "private" : "shared";
    setError("");
    setBusy(row.id);
    try {
      await client.plugins.update({ id: row.id, visibility });
      await refreshPlugins();
    } catch (caught) {
      setError(
        userFacingError(
          caught,
          visibility === "shared"
            ? "Could not share plugin"
            : "Could not make private",
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  async function addRemoteMcp() {
    const name = mcpName.trim();
    const url = mcpUrl.trim();
    const bearer = mcpBearer.trim();
    if (!name || !url) return;
    setBusy("mcp-add");
    setError("");
    try {
      const result = await client.mcp.add({
        ...(botId ? { botId } : {}),
        name,
        url,
        ...(bearer ? { bearer } : {}),
      });
      setMcpName("");
      setMcpUrl("");
      setMcpBearer("");
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
        <Pressable onPress={() => setTab("search")}>
          <Text style={tab === "search" ? styles.on : styles.meta}>Search</Text>
        </Pressable>
        <Pressable onPress={() => setTab("installed")}>
          <Text style={tab === "installed" ? styles.on : styles.meta}>
            Installed
          </Text>
        </Pressable>
      </View>
      <Field placeholder="Search" value={query} onChangeText={setQuery} />
      {tab === "search"
        ? visible.slice(0, 40).map((item) => {
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
                    label="Add"
                    tone="ghost"
                    busy={busy === item.id}
                    onPress={() => void addAccount(item)}
                  />
                </View>
              </View>
            );
          })
        : pluginAccounts.map((row) => {
            const name = catalogNames.get(row.toolkit) ?? row.toolkit;
            const mine = Boolean(meUserId && row.userId === meUserId);
            const live = row.status === "connected";
            return (
              <View key={row.id} style={styles.card}>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.meta}>{pluginAccountDetail(row)}</Text>
                <View style={styles.row}>
                  {live ? (
                    mine ? (
                      <Button
                        label={
                          row.visibility === "shared" ? "Make private" : "Share"
                        }
                        tone="ghost"
                        busy={busy === row.id}
                        onPress={() => void sharePluginAccount(row)}
                      />
                    ) : null
                  ) : (
                    <Button
                      label={
                        row.status === "connecting" ? "Continue" : "Connect"
                      }
                      busy={busy === row.id}
                      onPress={() => void authenticate(row.id)}
                    />
                  )}
                  <Button
                    label="Remove"
                    tone="danger"
                    busy={busy === row.id}
                    onPress={() => void removePluginAccount(row.id)}
                  />
                </View>
              </View>
            );
          })}
      {tab === "installed"
        ? mcpRows.map((row) => (
            <View key={row.id} style={styles.card}>
              <Text style={styles.name}>{row.name}</Text>
              <Text style={styles.meta}>
                {row.visibility === "private" ? "Private" : "Shared"} ·{" "}
                {mcpHostLabel(row.url)}
                {row.status === "connected" ? " · Connected" : ""}
              </Text>
              {probes[row.id] ? (
                <Text style={probes[row.id]?.ok ? styles.meta : styles.error}>
                  {probes[row.id]?.ok
                    ? probes[row.id]?.tools.length
                      ? `${probes[row.id]?.tools.length} tools`
                      : "Live, no tools yet"
                    : probes[row.id]?.error}
                </Text>
              ) : null}
              <View style={styles.row}>
                {row.status === "connected" ? (
                  <Button
                    label={busy === `probe:${row.id}` ? "Testing…" : "Test"}
                    tone="ghost"
                    busy={busy === `probe:${row.id}`}
                    onPress={() => {
                      setError("");
                      setBusy(`probe:${row.id}`);
                      void client.mcp
                        .probe({ id: row.id })
                        .then((result) => {
                          setProbes((prev) => ({ ...prev, [row.id]: result }));
                        })
                        .catch((caught) => {
                          setError(
                            userFacingError(caught, "Could not test MCP"),
                          );
                        })
                        .finally(() => setBusy(null));
                    }}
                  />
                ) : null}
                <Button
                  label="Remove"
                  tone="danger"
                  onPress={() => {
                    void client.mcp.remove({ id: row.id }).then(() => {
                      setProbes((prev) => {
                        const next = { ...prev };
                        delete next[row.id];
                        return next;
                      });
                      return queryClient.invalidateQueries({
                        queryKey: orpc.mcp.list.key(),
                      });
                    });
                  }}
                />
              </View>
            </View>
          ))
        : null}
      {tab === "installed" && query.trim().length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.name}>Custom MCP</Text>
          <Text style={styles.body}>
            Connect a remote server by URL. Bearer is optional when the server
            wants a static token instead of OAuth.
          </Text>
          <Field label="Name" value={mcpName} onChangeText={setMcpName} />
          <Field
            label="URL"
            value={mcpUrl}
            onChangeText={setMcpUrl}
            keyboardType="url"
          />
          <Field
            label="Bearer token"
            value={mcpBearer}
            onChangeText={setMcpBearer}
            placeholder="Optional"
            secure
            autoComplete="off"
          />
          <Button
            label={busy === "mcp-add" ? "Opening…" : "Add"}
            onPress={() => void addRemoteMcp()}
            busy={busy === "mcp-add"}
          />
        </View>
      ) : null}
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
});
