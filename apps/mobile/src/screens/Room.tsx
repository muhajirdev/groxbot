import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HeaderButton } from "../components/HeaderButton";
import { OfficeThread } from "../components/OfficeThread";
import { Screen } from "../components/Screen";
import { seatsFromRoomMembers } from "../lib/room-mention";
import { orpc } from "../lib/orpc";
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: room?.name ?? "Room",
      headerBackTitle: "Office",
      headerBackButtonDisplayMode: "default",
      headerRight: () => (
        <HeaderButton
          label="Members"
          onPress={() => navigation.navigate("RoomSettings", { roomId })}
        />
      ),
      unstable_headerRightItems: () => [
        {
          type: "button",
          label: "Members",
          icon: { type: "sfSymbol", name: "person.2" },
          variant: "prominent",
          onPress: () => navigation.navigate("RoomSettings", { roomId }),
        },
      ],
    });
  }, [navigation, room?.name, roomId]);

  return (
    <Screen>
      {live.length > 0 ? (
        <View style={styles.targets}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setTargetBotId(undefined)}
            style={styles.target}
          >
            <Text style={!targetBotId ? styles.on : styles.meta}>Everyone</Text>
          </Pressable>
          {live.map((seat) => (
            <Pressable
              key={seat.id}
              accessibilityRole="button"
              onPress={() => setTargetBotId(seat.id)}
              style={styles.target}
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
          members={members}
          targetBotId={targetBotId}
          description={room.description}
          kind="room"
          userId={meQuery.data?.userId}
          userName={meQuery.data?.name}
          onNeedsModel={() => navigation.navigate("You")}
          onUnarchive={() => undefined}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  targets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  target: { minHeight: 44, justifyContent: "center" },
  meta: { color: colors.muted, fontSize: 15 },
  on: { color: colors.text, fontWeight: "600", fontSize: 15 },
});
