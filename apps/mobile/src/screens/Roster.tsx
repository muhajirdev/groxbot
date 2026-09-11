import type { Bot, Room } from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../components/Avatar";
import { Field } from "../components/Field";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { takePendingBotId } from "../lib/pending";
import { client } from "../lib/rpc";
import {
  filterRooms,
  filterRoster,
  groupSidebarBots,
  isPinnedBot,
  mixSidebarLive,
  roomSidebarFaces,
  sortArchived,
  sortRoster,
} from "../lib/sidebar";
import { formatListTime } from "../lib/time";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";
import { useWorking } from "../working";

type Props = NativeStackScreenProps<RootStackParamList, "Roster">;

export function RosterScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const botsQuery = useQuery(orpc.bots.list.queryOptions());
  const roomsQuery = useQuery(orpc.rooms.list.queryOptions());
  const sectionsQuery = useQuery(orpc.sections.list.queryOptions());
  const meQuery = useQuery(orpc.me.queryOptions());
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);
  const [error, setError] = useState("");
  const liveBots = useMemo(
    () => filterRoster(sortRoster(botsQuery.data ?? []), query),
    [botsQuery.data, query],
  );
  const rooms = useMemo(
    () => filterRooms(roomsQuery.data ?? [], query),
    [roomsQuery.data, query],
  );
  const archived = useMemo(
    () => filterRoster(sortArchived(botsQuery.data ?? []), query),
    [botsQuery.data, query],
  );
  const grouped = useMemo(
    () => groupSidebarBots(liveBots, sectionsQuery.data ?? []),
    [liveBots, sectionsQuery.data],
  );
  const mixed = useMemo(
    () => mixSidebarLive(grouped.ungrouped, rooms),
    [grouped.ungrouped, rooms],
  );

  useEffect(() => {
    const botId = takePendingBotId();
    if (botId) navigation.navigate("Thread", { botId });
  }, [navigation]);

  function createMenu() {
    Alert.alert("Create", undefined, [
      { text: "Hire", onPress: () => navigation.navigate("Hire") },
      { text: "Room", onPress: () => navigation.navigate("CreateRoom") },
      { text: "Section", onPress: () => setCreatingSection(true) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function createSection() {
    const name = sectionName.trim();
    if (!name) return;
    setError("");
    try {
      await client.sections.create({ name });
      setSectionName("");
      setCreatingSection(false);
      await queryClient.invalidateQueries({ queryKey: orpc.sections.list.key() });
    } catch (caught) {
      setError(userFacingError(caught, "Could not create section"));
    }
  }

  function botMenu(bot: Bot) {
    const owner = bot.userId === meQuery.data?.userId;
    const sections = sectionsQuery.data ?? [];
    Alert.alert(bot.name, undefined, [
      {
        text: isPinnedBot(bot) ? "Unpin" : "Pin",
        onPress: () => {
          void (isPinnedBot(bot)
            ? client.bots.unpin({ botId: bot.id })
            : client.bots.pin({ botId: bot.id })
          ).then(() =>
            queryClient.invalidateQueries({ queryKey: orpc.bots.list.key() }),
          );
        },
      },
      {
        text: bot.archivedAt ? "Unarchive" : "Archive",
        onPress: () => {
          void (bot.archivedAt
            ? client.bots.unarchive({ botId: bot.id })
            : client.bots.archive({ botId: bot.id })
          ).then(() =>
            queryClient.invalidateQueries({ queryKey: orpc.bots.list.key() }),
          );
        },
      },
      ...(owner
        ? [
            {
              text:
                bot.visibility === "shared"
                  ? "Make private"
                  : "Share with office",
              onPress: () => {
                void client.bots
                  .update({
                    botId: bot.id,
                    visibility:
                      bot.visibility === "shared" ? "private" : "shared",
                  })
                  .then(() =>
                    queryClient.invalidateQueries({
                      queryKey: orpc.bots.list.key(),
                    }),
                  );
              },
            },
          ]
        : []),
      ...(sections.length > 0
        ? [
            {
              text: "Move to…",
              onPress: () => {
                Alert.alert(
                  "Move to",
                  undefined,
                  [
                    {
                      text: "Ungrouped",
                      onPress: () => {
                        void client.bots
                          .move({ botId: bot.id, sectionId: null })
                          .then(() =>
                            queryClient.invalidateQueries({
                              queryKey: orpc.bots.list.key(),
                            }),
                          );
                      },
                    },
                    ...sections.map((section) => ({
                      text: section.name,
                      onPress: () => {
                        void client.bots
                          .move({ botId: bot.id, sectionId: section.id })
                          .then(() =>
                            queryClient.invalidateQueries({
                              queryKey: orpc.bots.list.key(),
                            }),
                          );
                      },
                    })),
                    { text: "Cancel", style: "cancel" as const },
                  ],
                );
              },
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function sectionMenu(section: { id: string; name: string }) {
    Alert.alert(section.name, undefined, [
      {
        text: "Rename",
        onPress: () => {
          Alert.prompt?.(
            "Rename section",
            undefined,
            (next) => {
              const name = next.trim();
              if (!name) return;
              void client.sections
                .rename({ sectionId: section.id, name })
                .then(() =>
                  queryClient.invalidateQueries({
                    queryKey: orpc.sections.list.key(),
                  }),
                );
            },
            "plain-text",
            section.name,
          );
        },
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void client.sections.remove({ sectionId: section.id }).then(() =>
            Promise.all([
              queryClient.invalidateQueries({
                queryKey: orpc.sections.list.key(),
              }),
              queryClient.invalidateQueries({ queryKey: orpc.bots.list.key() }),
            ]),
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable onPress={() => navigation.navigate("You")}>
          <Text style={styles.title}>
            {meQuery.data?.workspaceName || "Office"}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={createMenu}>
          <Text style={styles.link}>+</Text>
        </Pressable>
      </View>
      <View style={styles.search}>
        <Field
          placeholder="Search teammates and rooms"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      {creatingSection ? (
        <View style={styles.sectionCreate}>
          <Field
            placeholder="Section name"
            value={sectionName}
            onChangeText={setSectionName}
          />
          <Pressable onPress={() => void createSection()}>
            <Text style={styles.accent}>Save</Text>
          </Pressable>
        </View>
      ) : null}
      {error || botsQuery.isError || roomsQuery.isError ? (
        <Text style={styles.error}>
          {error || "Could not load the office."}
        </Text>
      ) : null}
      {meQuery.data?.needsHostedPlan ? (
        <Pressable
          onPress={() => navigation.navigate("Billing")}
          style={styles.planBanner}
        >
          <Text style={styles.accent}>Subscribe to keep talking →</Text>
        </Pressable>
      ) : null}
      <ScrollView
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
      >
        {mixed.length === 0 &&
        grouped.sections.every((bucket) => bucket.bots.length === 0) &&
        !botsQuery.isLoading ? (
          <View style={styles.empty}>
            <Text style={styles.body}>
              {query.trim()
                ? "Nothing matches that."
                : "No bots yet. Hire one to get started."}
            </Text>
          </View>
        ) : null}
        {mixed.map((row) =>
          row.kind === "bot" ? (
            <BotRow
              key={row.item.id}
              bot={row.item}
              onPress={() =>
                navigation.navigate("Thread", { botId: row.item.id })
              }
              onLongPress={() => botMenu(row.item)}
            />
          ) : (
            <RoomRow
              key={row.item.id}
              room={row.item}
              onPress={() =>
                navigation.navigate("Room", { roomId: row.item.id })
              }
            />
          ),
        )}
        {grouped.sections.map((bucket) =>
          bucket.bots.length === 0 && query.trim() ? null : (
            <View key={bucket.section.id}>
              <Pressable
                onLongPress={() => sectionMenu(bucket.section)}
                style={styles.sectionHead}
              >
                <Text style={styles.sectionTitle}>{bucket.section.name}</Text>
              </Pressable>
              {bucket.bots.map((bot) => (
                <BotRow
                  key={bot.id}
                  bot={bot}
                  onPress={() => navigation.navigate("Thread", { botId: bot.id })}
                  onLongPress={() => botMenu(bot)}
                />
              ))}
            </View>
          ),
        )}
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
                onLongPress={() => botMenu(bot)}
              />
            ))
          : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable onPress={() => navigation.navigate("Board")}>
          <Text style={styles.meta}>Board</Text>
        </Pressable>
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
  onLongPress,
  muted,
}: {
  bot: Bot;
  onPress: () => void;
  onLongPress?: () => void;
  muted?: boolean;
}) {
  const working = useWorking(bot.id);
  const pinned = isPinnedBot(bot);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
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
            {bot.visibility === "private" ? " · private" : ""}
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

function RoomRow({
  room,
  onPress,
}: {
  room: Room;
  onPress: () => void;
}) {
  const faces = roomSidebarFaces(room.members);
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={styles.faces}>
        {faces.slice(0, 2).map((member) => (
          <Avatar
            key={member.botId}
            name={member.name}
            color={member.avatarColor}
            shape={member.avatarShape}
            size={28}
          />
        ))}
      </View>
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {room.name}
          </Text>
          <Text style={styles.time}>{formatListTime(room.lastAt)}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {room.lastPreview || "Group table"}
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
  title: { color: colors.text, fontSize: 22, fontWeight: "600", letterSpacing: -0.4 },
  search: { paddingHorizontal: 16 },
  sectionCreate: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 12 },
  archivedToggle: { paddingHorizontal: 16, paddingVertical: 10 },
  mutedRow: { opacity: 0.7 },
  link: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "400",
    paddingHorizontal: 8,
  },
  accent: { color: colors.accent, fontWeight: "700" },
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
  faces: { flexDirection: "row", width: 44, justifyContent: "center" },
  sectionHead: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  sectionTitle: { color: colors.muted, fontWeight: "700", fontSize: 12 },
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
  planBanner: { paddingHorizontal: 16, paddingBottom: 8 },
});
