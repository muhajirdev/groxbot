import type { Bot } from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../components/Avatar";
import { Field } from "../components/Field";
import { Screen } from "../components/Screen";
import { orpc } from "../lib/orpc";
import { takePendingBotId } from "../lib/pending";
import {
  filterRoster,
  isPinnedBot,
  sortArchived,
  sortRoster,
} from "../lib/sidebar";
import { formatListTime } from "../lib/time";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";
import { useWorking } from "../working";

type Props = NativeStackScreenProps<RootStackParamList, "Roster">;

export function RosterScreen({ navigation }: Props) {
  const botsQuery = useQuery(orpc.bots.list.queryOptions());
  const meQuery = useQuery(orpc.me.queryOptions());
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const live = useMemo(
    () => filterRoster(sortRoster(botsQuery.data ?? []), query),
    [botsQuery.data, query],
  );
  const archived = useMemo(
    () => filterRoster(sortArchived(botsQuery.data ?? []), query),
    [botsQuery.data, query],
  );

  useEffect(() => {
    const botId = takePendingBotId();
    if (botId) navigation.navigate("Thread", { botId });
  }, [navigation]);

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={styles.title}>
          {meQuery.data?.workspaceName || "Office"}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Hire")}
        >
          <Text style={styles.link}>+</Text>
        </Pressable>
      </View>
      <View style={styles.search}>
        <Field
          placeholder="Search teammates"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      {botsQuery.isError ? (
        <Text style={styles.error}>Could not load teammates.</Text>
      ) : null}
      <ScrollView
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
      >
        {live.length === 0 && !botsQuery.isLoading ? (
          <View style={styles.empty}>
            <Text style={styles.body}>
              {query.trim()
                ? "No teammates match that."
                : "No teammates yet. Hire one to start."}
            </Text>
          </View>
        ) : null}
        {live.map((bot) => (
          <BotRow
            key={bot.id}
            bot={bot}
            onPress={() => navigation.navigate("Thread", { botId: bot.id })}
          />
        ))}
        {archived.length > 0 ? (
          <Pressable
            onPress={() => setShowArchived((value) => !value)}
            style={styles.archivedToggle}
          >
            <Text style={styles.meta}>
              {showArchived ? "Hide archived" : `Archived (${archived.length})`}
            </Text>
          </Pressable>
        ) : null}
        {showArchived
          ? archived.map((bot) => (
              <BotRow
                key={bot.id}
                bot={bot}
                muted
                onPress={() => navigation.navigate("Thread", { botId: bot.id })}
              />
            ))
          : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable onPress={() => navigation.navigate("Plugins")}>
          <Text style={styles.meta}>Plugins</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Knowledge")}>
          <Text style={styles.meta}>Knowledge</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("You")}>
          <Text style={styles.meta}>You</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function BotRow({
  bot,
  onPress,
  muted,
}: {
  bot: Bot;
  onPress: () => void;
  muted?: boolean;
}) {
  const working = useWorking(bot.id);
  const pinned = isPinnedBot(bot);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, muted ? styles.mutedRow : null]}
      accessibilityRole="button"
    >
      <Avatar
        name={bot.name}
        color={bot.avatarColor}
        shape={bot.avatarShape}
        size={44}
        working={working}
      />
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {bot.name}
            {pinned ? " · pinned" : ""}
          </Text>
          <Text style={styles.time}>{formatListTime(bot.lastAt)}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {bot.lastPreview || bot.title || " "}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  search: { paddingHorizontal: 16 },
  list: { flex: 1 },
  listContent: { paddingBottom: 12 },
  archivedToggle: { paddingHorizontal: 16, paddingVertical: 10 },
  mutedRow: { opacity: 0.7 },
  link: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: "600",
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  copy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  name: { color: colors.text, fontSize: 16, fontWeight: "600", flex: 1 },
  time: { color: colors.faint, fontSize: 11 },
  preview: { color: colors.muted, fontSize: 13, marginTop: 2 },
  footer: {
    marginTop: "auto",
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  meta: { color: colors.muted, fontWeight: "600" },
  empty: { padding: 24 },
  body: { color: colors.muted, fontSize: 16 },
  error: { color: colors.danger, paddingHorizontal: 16 },
});
