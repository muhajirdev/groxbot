import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { isArchivedBot } from "../lib/sidebar";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "RoomSettings">;

export function RoomSettingsScreen({ navigation, route }: Props) {
  const { roomId } = route.params;
  const queryClient = useQueryClient();
  const roomQuery = useQuery(
    orpc.rooms.get.queryOptions({ input: { roomId } }),
  );
  const botsQuery = useQuery(orpc.bots.list.queryOptions());
  const room = roomQuery.data;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!room) return;
    setName(room.name);
    setDescription(room.description);
  }, [room]);

  const seated = useMemo(
    () => new Set((room?.members ?? []).map((row) => row.botId)),
    [room],
  );
  const candidates = useMemo(
    () =>
      (botsQuery.data ?? []).filter(
        (bot) => !isArchivedBot(bot) && !seated.has(bot.id),
      ),
    [botsQuery.data, seated],
  );

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await client.rooms.update({
        roomId,
        name: name.trim(),
        description: description.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: orpc.rooms.get.key() });
      await queryClient.invalidateQueries({ queryKey: orpc.rooms.list.key() });
      navigation.goBack();
    } catch (caught) {
      setError(userFacingError(caught, "Could not save room"));
    } finally {
      setBusy(false);
    }
  }

  async function invite(botId: string) {
    setBusy(true);
    setError("");
    try {
      await client.rooms.invite({ roomId, memberBotIds: [botId] });
      await queryClient.invalidateQueries({ queryKey: orpc.rooms.get.key() });
      await queryClient.invalidateQueries({ queryKey: orpc.rooms.list.key() });
    } catch (caught) {
      setError(userFacingError(caught, "Could not invite"));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Delete this room?", "The log stays gone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void client.rooms.delete({ roomId }).then(async () => {
            await queryClient.invalidateQueries({
              queryKey: orpc.rooms.list.key(),
            });
            navigation.navigate("Office");
          });
        },
      },
    ]);
  }

  useLayoutEffect(() => {
    navigation.setOptions({ title: room?.name ?? "Members" });
  }, [navigation, room?.name]);

  return (
    <Screen scroll>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Field label="Name" value={name} onChangeText={setName} />
      <Field
        label="Brief"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Text style={styles.section}>Seated</Text>
      {(room?.members ?? []).map((member) => (
        <Text key={member.botId} style={styles.body}>
          {member.name}
          {member.title ? ` · ${member.title}` : ""}
        </Text>
      ))}
      {candidates.length > 0 ? (
        <>
          <Text style={styles.section}>Invite</Text>
          {candidates.map((bot) => (
            <Pressable
              key={bot.id}
              onPress={() => void invite(bot.id)}
              style={styles.option}
            >
              <Text style={styles.link}>Add {bot.name}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
      <Button label="Save" onPress={() => void save()} busy={busy} />
      <Button label="Delete room" tone="danger" onPress={confirmDelete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger },
  section: { color: colors.text, fontWeight: "700", marginTop: 12 },
  option: { paddingVertical: 8 },
  body: { color: colors.text, fontSize: 15 },
  link: { color: colors.accent, fontWeight: "600" },
});
