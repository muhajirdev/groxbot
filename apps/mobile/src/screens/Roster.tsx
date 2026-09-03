import type { Bot } from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../components/Avatar";
import { Screen } from "../components/Screen";
import { orpc } from "../lib/orpc";
import { takePendingBotId } from "../lib/pending";
import { isPinnedBot, sortRoster } from "../lib/sidebar";
import { formatListTime } from "../lib/time";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";
import { useWorking } from "../working";

type Props = NativeStackScreenProps<RootStackParamList, "Roster">;

export function RosterScreen({ navigation }: Props) {
  const botsQuery = useQuery(orpc.bots.list.queryOptions());
  const meQuery = useQuery(orpc.me.queryOptions());
  const bots = sortRoster(botsQuery.data ?? []);

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
      {botsQuery.isError ? (
        <Text style={styles.error}>Could not load teammates.</Text>
      ) : null}
      {bots.length === 0 && !botsQuery.isLoading ? (
        <View style={styles.empty}>
          <Text style={styles.body}>No teammates yet. Hire one to start.</Text>
        </View>
      ) : null}
      {bots.map((bot) => (
        <BotRow
          key={bot.id}
          bot={bot}
          onPress={() => navigation.navigate("Thread", { botId: bot.id })}
        />
      ))}
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

function BotRow({ bot, onPress }: { bot: Bot; onPress: () => void }) {
  const working = useWorking(bot.id);
  const pinned = isPinnedBot(bot);
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
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
          </Text>
          <Text style={styles.time}>{formatListTime(bot.lastAt)}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {bot.lastPreview || bot.title || (pinned ? "Pinned" : " ")}
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
