import type { Bot, Room } from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { EmptyDesk } from "../components/EmptyDesk";
import { Field } from "../components/Field";
import { HeaderButton } from "../components/HeaderButton";
import { OfficeSidebar } from "../components/OfficeSidebar";
import { PressableRow } from "../components/PressableRow";
import { Sheet, SheetRow } from "../components/Sheet";
import { showActionSheet } from "../lib/action-sheet";
import { userFacingError } from "../lib/errors";
import { tapSelect } from "../lib/haptics";
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
import { officeQueryKey } from "../lib/workspace-switch";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";
import { useWorking } from "../working";

type Props = NativeStackScreenProps<RootStackParamList, "Office">;

export function RosterScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const meQuery = useQuery(orpc.me.queryOptions());
  const workspaceId = meQuery.data?.workspaceId ?? "";
  const botsQuery = useQuery({
    ...orpc.bots.list.queryOptions(),
    queryKey: officeQueryKey(orpc.bots.list.queryOptions().queryKey, workspaceId),
    enabled: Boolean(workspaceId),
  });
  const roomsQuery = useQuery({
    ...orpc.rooms.list.queryOptions(),
    queryKey: officeQueryKey(orpc.rooms.list.queryOptions().queryKey, workspaceId),
    enabled: Boolean(workspaceId),
  });
  const sectionsQuery = useQuery({
    ...orpc.sections.list.queryOptions(),
    queryKey: officeQueryKey(
      orpc.sections.list.queryOptions().queryKey,
      workspaceId,
    ),
    enabled: Boolean(workspaceId),
  });
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const openSidebar = () => setSidebarOpen(true);
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: meQuery.data?.workspaceName || "Office",
      headerSearchBarOptions: {
        placeholder: "Search",
        hideWhenScrolling: true,
        onChangeText: (event) => setQuery(event.nativeEvent.text),
      },
      headerLeft: () => (
        <HeaderButton
          label="Menu"
          symbol="sidebar.left"
          align="start"
          onPress={openSidebar}
        />
      ),
      headerRight: () => (
        <HeaderButton
          label="Create"
          symbol="plus"
          onPress={() => {
            setCreatingSection(false);
            setCreateOpen(true);
          }}
        />
      ),
      unstable_headerLeftItems: () => [
        {
          type: "button",
          label: "Menu",
          icon: { type: "sfSymbol", name: "sidebar.left" },
          variant: "prominent",
          sharesBackground: true,
          identifier: "sidebar",
          onPress: openSidebar,
        },
      ],
      unstable_headerRightItems: () => [
        {
          type: "button",
          label: "Create",
          icon: { type: "sfSymbol", name: "plus" },
          variant: "prominent",
          sharesBackground: true,
          identifier: "create",
          onPress: () => {
            setCreatingSection(false);
            setCreateOpen(true);
          },
        },
      ],
    });
  }, [meQuery.data?.workspaceName, navigation]);

  function closeCreate() {
    setCreateOpen(false);
    setCreatingSection(false);
    setSectionName("");
  }

  async function createSection() {
    const name = sectionName.trim();
    if (!name) return;
    setError("");
    try {
      await client.sections.create({ name });
      closeCreate();
      await queryClient.invalidateQueries({ queryKey: orpc.sections.list.key() });
    } catch (caught) {
      setError(userFacingError(caught, "Could not create section"));
    }
  }

  function botMenu(bot: Bot) {
    const owner = bot.userId === meQuery.data?.userId;
    const sections = sectionsQuery.data ?? [];
    showActionSheet(bot.name, [
      {
        label: isPinnedBot(bot) ? "Unpin" : "Pin",
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
        label: bot.archivedAt ? "Unarchive" : "Archive",
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
              label:
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
              label: "Move to…",
              onPress: () => {
                showActionSheet("Move to", [
                  {
                    label: "Ungrouped",
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
                    label: section.name,
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
                  { label: "Cancel", cancel: true },
                ]);
              },
            },
          ]
        : []),
      { label: "Cancel", cancel: true },
    ]);
  }

  function sectionMenu(section: { id: string; name: string }) {
    showActionSheet(section.name, [
      {
        label: "Rename",
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
        label: "Delete",
        destructive: true,
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
      { label: "Cancel", cancel: true },
    ]);
  }

  const empty =
    mixed.length === 0 &&
    grouped.sections.every((bucket) => bucket.bots.length === 0) &&
    !botsQuery.isLoading;
  const firstLoad = botsQuery.isLoading && !botsQuery.data;

  return (
    <>
      <ScrollView
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            tintColor={colors.muted}
            refreshing={botsQuery.isRefetching || roomsQuery.isRefetching}
            onRefresh={() => {
              void Promise.all([
                botsQuery.refetch(),
                roomsQuery.refetch(),
                sectionsQuery.refetch(),
              ]);
            }}
          />
        }
      >
      {error || botsQuery.isError || roomsQuery.isError ? (
        <Text style={styles.error}>
          {error || "Could not load the office."}
        </Text>
      ) : null}
        {firstLoad ? <RosterSkeleton /> : null}
        {empty ? (
          <EmptyDesk
            title={query.trim() ? "Nobody by that name." : "Quiet in here."}
            lede={
              query.trim()
                ? "Try another search, or hire someone new."
                : "Hire a teammate and the office starts talking."
            }
          >
            {query.trim() ? null : (
              <Button
                label="Hire someone"
                tone="brand"
                onPress={() => navigation.navigate("Hire")}
              />
            )}
          </EmptyDesk>
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
                accessibilityRole="button"
                accessibilityState={{ expanded: !collapsed[bucket.section.id] }}
                onPress={() => {
                  tapSelect();
                  setCollapsed((prev) => ({
                    ...prev,
                    [bucket.section.id]: !prev[bucket.section.id],
                  }));
                }}
                onLongPress={() => sectionMenu(bucket.section)}
                style={({ pressed }) => [
                  styles.sectionHead,
                  pressed ? styles.sectionPressed : null,
                ]}
              >
                <Text style={styles.sectionTitle} numberOfLines={1}>
                  {bucket.section.name}
                </Text>
                <Text style={styles.sectionMeta}>
                  {bucket.bots.length}
                  {collapsed[bucket.section.id] ? "  ›" : ""}
                </Text>
              </Pressable>
              {collapsed[bucket.section.id]
                ? null
                : bucket.bots.map((bot) => (
                    <BotRow
                      key={bot.id}
                      bot={bot}
                      onPress={() =>
                        navigation.navigate("Thread", { botId: bot.id })
                      }
                      onLongPress={() => botMenu(bot)}
                    />
                  ))}
              {collapsed[bucket.section.id] || bucket.bots.length > 0 ? null : (
                <Text style={styles.sectionEmpty}>Nobody here yet.</Text>
              )}
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
      <OfficeSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOffice={() => navigation.navigate("Office")}
        onBoard={() => navigation.navigate("Board")}
        onKnowledge={() => navigation.navigate("Knowledge")}
        onPlugins={() => navigation.navigate("Plugins")}
        onSettings={() => navigation.navigate("You")}
      />
      <Sheet
        open={createOpen}
        title={creatingSection ? "New section" : "Create"}
        onClose={closeCreate}
      >
        {creatingSection ? (
          <View style={styles.sheetForm}>
            <Field
              placeholder="Sales"
              value={sectionName}
              onChangeText={setSectionName}
              autoCapitalize="words"
            />
            <Button
              label="Create section"
              onPress={() => void createSection()}
              disabled={!sectionName.trim()}
            />
            <SheetRow
              label="Back"
              tone="muted"
              onPress={() => {
                setCreatingSection(false);
                setSectionName("");
              }}
            />
          </View>
        ) : (
          <>
            <SheetRow
              label="New bot"
              hint="Hire a teammate."
              onPress={() => {
                closeCreate();
                navigation.navigate("Hire");
              }}
            />
            <SheetRow
              label="New room"
              hint="A table for several teammates."
              onPress={() => {
                closeCreate();
                navigation.navigate("CreateRoom");
              }}
            />
            <SheetRow
              label="New section"
              hint="A group in the roster."
              onPress={() => setCreatingSection(true)}
            />
          </>
        )}
      </Sheet>
    </>
  );
}

function botPreview(bot: Bot, pinned: boolean): string {
  return (
    bot.lastPreview ||
    bot.title ||
    (pinned ? "Pinned" : bot.visibility === "private" ? "Private" : "")
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
  const preview = working ? "Working…" : botPreview(bot, pinned);
  return (
    <PressableRow
      onPress={onPress}
      onLongPress={onLongPress}
      highlight
      accessibilityLabel={bot.name}
      style={[styles.row, muted ? styles.mutedRow : null]}
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
          </Text>
          <Text style={styles.time}>{formatListTime(bot.lastAt)}</Text>
        </View>
        {preview ? (
          <Text
            style={[styles.preview, working ? styles.working : null]}
            numberOfLines={1}
          >
            {preview}
          </Text>
        ) : null}
      </View>
    </PressableRow>
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
    <PressableRow
      onPress={onPress}
      highlight
      accessibilityLabel={room.name}
      style={styles.row}
    >
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
          {room.lastPreview || "Room"}
        </Text>
      </View>
    </PressableRow>
  );
}

function RosterSkeleton() {
  return (
    <View>
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.skelAvatar} />
          <View style={styles.copy}>
            <View style={[styles.skelLine, styles.skelName]} />
            <View style={[styles.skelLine, styles.skelPreview]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheetForm: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  list: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: 12 },
  archivedToggle: { paddingHorizontal: 20, paddingVertical: 14 },
  mutedRow: { opacity: 0.55 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 16,
    minHeight: 64,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 2,
    paddingRight: 20,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    flex: 1,
  },
  time: { color: colors.faint, fontSize: 15, lineHeight: 22 },
  preview: { color: colors.muted, fontSize: 15, lineHeight: 20 },
  faces: {
    width: 44,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHead: {
    minHeight: 44,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionPressed: { opacity: 0.65 },
  sectionTitle: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 15,
    letterSpacing: -0.2,
    flex: 1,
  },
  sectionMeta: {
    color: colors.faint,
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  sectionEmpty: {
    color: colors.faint,
    fontSize: 15,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  meta: { color: colors.muted, fontWeight: "600" },
  working: { color: colors.accent },
  error: { color: colors.danger, paddingHorizontal: 20, paddingTop: 8 },
  skelAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  skelName: { width: "42%", marginBottom: 8 },
  skelPreview: { width: "68%" },
});
