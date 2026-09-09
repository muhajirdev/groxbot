import type { Room, RoomWorkStatus } from "@groxbot/contracts";
import {
  groupRoomsByWorkStatus,
  ROOM_WORK_STATUS_LABEL,
  ROOM_WORK_STATUSES,
  roomSidebarFaces,
} from "@groxbot/core/browser";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../components/Avatar";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { formatListTime } from "../lib/time";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Board">;

export function BoardScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const roomsQuery = useQuery(orpc.rooms.list.queryOptions());
  const grouped = useMemo(
    () => groupRoomsByWorkStatus(roomsQuery.data ?? []),
    [roomsQuery.data],
  );

  async function setStatus(room: Room, status: RoomWorkStatus) {
    if (room.status === status) return;
    queryClient.setQueryData(orpc.rooms.list.queryOptions().queryKey, (rows) =>
      rows?.map((row) => (row.id === room.id ? { ...row, status } : row)),
    );
    try {
      await client.rooms.update({ roomId: room.id, status });
    } catch (caught) {
      await queryClient.invalidateQueries({ queryKey: orpc.rooms.list.key() });
      console.warn(userFacingError(caught, "Could not move room"));
    }
  }

  return (
    <Screen>
      <Header
        title="Board"
        onBack={() => navigation.navigate("Roster")}
        right={
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("CreateRoom")}
          >
            <Text style={styles.link}>New</Text>
          </Pressable>
        }
      />
      {roomsQuery.isError ? (
        <Text style={styles.error}>Could not load rooms.</Text>
      ) : null}
      <ScrollView
        horizontal
        style={styles.board}
        contentContainerStyle={styles.boardContent}
      >
        {ROOM_WORK_STATUSES.map((status) => (
          <View key={status} style={styles.column}>
            <View style={styles.colHead}>
              <Text style={styles.colTitle}>
                {ROOM_WORK_STATUS_LABEL[status]}
              </Text>
              <Pressable
                onPress={() => navigation.navigate("CreateRoom", { status })}
              >
                <Text style={styles.meta}>+</Text>
              </Pressable>
            </View>
            {(grouped[status] ?? []).map((room) => (
              <Pressable
                key={room.id}
                style={styles.card}
                onPress={() => navigation.navigate("Room", { roomId: room.id })}
                onLongPress={() => {
                  const next =
                    ROOM_WORK_STATUSES[
                      (ROOM_WORK_STATUSES.indexOf(room.status) + 1) %
                        ROOM_WORK_STATUSES.length
                    ];
                  if (next) void setStatus(room, next);
                }}
              >
                <Text style={styles.name} numberOfLines={2}>
                  {room.name}
                </Text>
                {room.lastPreview ? (
                  <Text style={styles.preview} numberOfLines={2}>
                    {room.lastPreview}
                  </Text>
                ) : null}
                <View style={styles.faces}>
                  {roomSidebarFaces(room.members).map((member) => (
                    <Avatar
                      key={member.botId}
                      name={member.name}
                      color={member.avatarColor}
                      shape={member.avatarShape}
                      size={20}
                    />
                  ))}
                  <Text style={styles.time}>{formatListTime(room.lastAt)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1 },
  boardContent: { padding: 12, gap: 12 },
  column: { width: 240, gap: 8 },
  colHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  colTitle: { color: colors.text, fontWeight: "700" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  name: { color: colors.text, fontWeight: "600" },
  preview: { color: colors.muted, fontSize: 13 },
  faces: { flexDirection: "row", alignItems: "center", gap: 4 },
  time: { color: colors.faint, fontSize: 11, marginLeft: "auto" },
  link: { color: colors.text, fontWeight: "500" },
  meta: { color: colors.muted, fontSize: 20, fontWeight: "400" },
  error: { color: colors.danger, paddingHorizontal: 16 },
});
