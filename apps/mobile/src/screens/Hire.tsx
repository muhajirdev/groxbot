import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import { nextAvatarColor, nextHireName } from "../lib/hire";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Hire">;

export function HireScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const botsQuery = useQuery(orpc.bots.list.queryOptions());
  const meQuery = useQuery(orpc.me.queryOptions());
  const [name, setName] = useState(nextHireName(botsQuery.data ?? []));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function hire() {
    const next = name.trim();
    if (!next) return;
    setBusy(true);
    setError("");
    try {
      const bot = await client.bots.create({
        name: next,
        avatarColor: nextAvatarColor(botsQuery.data ?? []),
      });
      await queryClient.invalidateQueries({ queryKey: orpc.bots.list.key() });
      navigation.replace("Thread", { botId: bot.id });
    } catch (caught) {
      setError(userFacingError(caught, "Could not hire"));
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Header title="New Bot" onBack={() => navigation.goBack()} />
      {meQuery.data?.needsModel ? (
        <Text style={styles.warn}>
          Add a model key in You before this teammate can talk.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Piper"
        autoCapitalize="words"
      />
      <Button
        label="Hire"
        onPress={() => void hire()}
        busy={busy}
        disabled={!name.trim()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger },
  warn: { color: colors.muted },
});
