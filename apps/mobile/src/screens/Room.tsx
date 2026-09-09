import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../components/Avatar";
import { Header } from "../components/Header";
import { OfficeThread } from "../components/OfficeThread";
import { Screen } from "../components/Screen";
import { seatsFromRoomMembers } from "../lib/room-mention";
import { orpc } from "../lib/orpc";
import { roomSidebarFaces } from "../lib/sidebar";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Room">;

export function RoomScreen({ navigation, route }: Props) {
  const { roomId } = route.params;
  const meQuery = useQuery(orpc.me.queryOptions());
  const roomQuery = useQuery(
    orpc.rooms.get.queryOptions({ input: { roomId } }),
  );
  const room = roomQuery.data;
  const [targetBotId, setTargetBotId] = useState<string | undefined>();
  const members = useMemo(
    () => seatsFromRoomMembers(room?.members ?? []),
    [room],
  );
  const live = members.filter((row) => !row.archivedAt);
  const faces = room ? roomSidebarFaces(room.members) : [];

  return (
    <Screen>
      <Header
        title={room?.name ?? "Room"}
        onBack={() => navigation.navigate("Roster")}
        right={
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("RoomSettings", { roomId })}
          >
            <Text style={styles.link}>Settings</Text>
          </Pressable>
        }
      />
      {room ? (
        <View style={styles.ident}>
          <View style={styles.faces}>
            {faces.map((member) => (
              <Avatar
                key={member.botId}
                name={member.name}
                color={member.avatarColor}
                shape={member.avatarShape}
                size={22}
              />
            ))}
          </View>
          <Text style={styles.job} numberOfLines={1}>
            {room.description || "Group table"}
          </Text>
        </View>
      ) : null}
      {live.length > 0 ? (
        <View style={styles.targets}>
          <Pressable onPress={() => setTargetBotId(undefined)}>
            <Text style={!targetBotId ? styles.on : styles.meta}>Everyone</Text>
          </Pressable>
          {live.map((seat) => (
            <Pressable
              key={seat.id}
              onPress={() => setTargetBotId(seat.id)}
            >
              <Text style={targetBotId === seat.id ? styles.on : styles.meta}>
                @{seat.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {room ? (
        <OfficeThread
          botId={roomId}
          roomId={roomId}
          botName={room.name}
          archived={false}
          needsModel={Boolean(meQuery.data?.needsModel)}
          needsHostedPlan={Boolean(meQuery.data?.needsHostedPlan)}
          members={members}
          targetBotId={targetBotId}
          description={room.description}
          kind="room"
          userId={meQuery.data?.userId}
          userName={meQuery.data?.name}
          onNeedsModel={() => navigation.navigate("You")}
          onNeedsHostedPlan={() => navigation.navigate("Billing")}
          onOpenPath={(path) => navigation.navigate("Knowledge", { path })}
          onUnarchive={() => undefined}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ident: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  faces: { flexDirection: "row", gap: 4 },
  job: { color: colors.muted, flex: 1, fontSize: 13 },
  targets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  link: { color: colors.text, fontWeight: "500" },
  meta: { color: colors.muted, fontWeight: "600" },
  on: { color: colors.accent, fontWeight: "700" },
});
