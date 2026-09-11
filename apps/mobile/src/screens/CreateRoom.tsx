import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { isArchivedBot } from "../lib/sidebar";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CreateRoom">;

export function CreateRoomScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const botsQuery = useQuery(orpc.bots.list.queryOptions());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const live = useMemo(
    () => (botsQuery.data ?? []).filter((bot) => !isArchivedBot(bot)),
    [botsQuery.data],
  );

  function toggle(botId: string) {
    setPicked((current) =>
      current.includes(botId)
        ? current.filter((id) => id !== botId)
        : [...current, botId],
    );
  }

  async function create() {
    const next = name.trim();
    if (!next) return;
    setBusy(true);
    setError("");
    try {
      const room = await client.rooms.create({
        name: next,
        description: description.trim() || undefined,
        memberBotIds: picked,
      });
      await queryClient.invalidateQueries({ queryKey: orpc.rooms.list.key() });
      navigation.replace("Room", { roomId: room.id });
    } catch (caught) {
      setError(userFacingError(caught, "Could not create room"));
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Header title="New room" onBack={() => navigation.goBack()} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Weekly standup"
        autoCapitalize="sentences"
      />
      <Field
        label="Brief"
        value={description}
        onChangeText={setDescription}
        placeholder="What this table is for"
        multiline
      />
      <Text style={styles.section}>Assign teammates</Text>
      {live.map((bot) => {
        const on = picked.includes(bot.id);
        return (
          <Pressable
            key={bot.id}
            onPress={() => toggle(bot.id)}
            style={styles.option}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <View>
              <Text style={on ? styles.on : styles.body}>{bot.name}</Text>
              {bot.title ? <Text style={styles.meta}>{bot.title}</Text> : null}
            </View>
          </Pressable>
        );
      })}
      <Button
        label="Create room"
        onPress={() => void create()}
        busy={busy}
        disabled={!name.trim()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger },
  section: { color: colors.text, fontWeight: "700", marginTop: 12 },
  option: { paddingVertical: 8 },
  body: { color: colors.text, fontSize: 15 },
  on: { color: colors.accent, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12 },
});
