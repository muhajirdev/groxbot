import {
  CUSTOM_MODEL_SENTINEL,
  catalogGroupLabel,
  PROVIDER_ORDER,
  pickerCatalog,
} from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Field } from "../components/Field";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import { AVATAR_COLORS, AVATAR_SHAPES } from "../lib/jobs";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { isPinnedBot } from "../lib/sidebar";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "BotSettings">;

export function BotSettingsScreen({ navigation, route }: Props) {
  const { botId } = route.params;
  const queryClient = useQueryClient();
  const botQuery = useQuery(orpc.bots.get.queryOptions({ input: { botId } }));
  const modelsQuery = useQuery(orpc.models.get.queryOptions());
  const bot = botQuery.data;
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [shape, setShape] = useState<(typeof AVATAR_SHAPES)[number]>("circle");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bot) return;
    setName(bot.name);
    setColor(bot.avatarColor);
    setShape(bot.avatarShape);
    const listed = (modelsQuery.data?.catalog ?? []).some(
      (item) => item.id === bot.model,
    );
    setModel(listed || !bot.model ? bot.model : CUSTOM_MODEL_SENTINEL);
    setCustomModel(listed ? "" : bot.model);
  }, [bot, modelsQuery.data]);

  if (!bot) {
    return (
      <Screen>
        <Header title="Settings" onBack={() => navigation.goBack()} />
      </Screen>
    );
  }

  const pinned = isPinnedBot(bot);
  const current = bot;
  const catalog = pickerCatalog(
    modelsQuery.data?.catalog ?? [],
    bot.model || modelsQuery.data?.defaultModelId || "",
  );

  async function save() {
    setBusy(true);
    setError("");
    try {
      const nextModel =
        model === CUSTOM_MODEL_SENTINEL ? customModel.trim() : model;
      await client.bots.update({
        botId,
        name: name.trim() || current.name,
        avatarColor: color,
        avatarShape: shape,
        model: nextModel,
      });
      await queryClient.invalidateQueries({ queryKey: orpc.bots.get.key() });
      await queryClient.invalidateQueries({ queryKey: orpc.bots.list.key() });
      navigation.goBack();
    } catch (caught) {
      setError(userFacingError(caught, "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  async function togglePin() {
    try {
      if (pinned) await client.bots.unpin({ botId });
      else await client.bots.pin({ botId });
      await queryClient.invalidateQueries({ queryKey: orpc.bots.get.key() });
      await queryClient.invalidateQueries({ queryKey: orpc.bots.list.key() });
    } catch (caught) {
      setError(userFacingError(caught, "Could not update pin"));
    }
  }

  async function archive() {
    try {
      if (current.archivedAt) await client.bots.unarchive({ botId });
      else await client.bots.archive({ botId });
      await queryClient.invalidateQueries({ queryKey: orpc.bots.list.key() });
      navigation.navigate("Roster");
    } catch (caught) {
      setError(userFacingError(caught, "Could not archive"));
    }
  }

  function confirmDelete() {
    Alert.alert("Delete this teammate?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void client.bots.delete({ botId }).then(async () => {
            await queryClient.invalidateQueries({
              queryKey: orpc.bots.list.key(),
            });
            navigation.navigate("Roster");
          });
        },
      },
    ]);
  }

  return (
    <Screen scroll>
      <Header title={bot.name} onBack={() => navigation.goBack()} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Avatar name={name || bot.name} color={color} shape={shape} size={64} />
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <View style={styles.row}>
        {AVATAR_COLORS.map((swatch) => (
          <Pressable
            key={swatch}
            onPress={() => setColor(swatch)}
            style={[
              styles.swatch,
              { backgroundColor: swatch },
              color === swatch ? styles.swatchOn : null,
            ]}
          />
        ))}
      </View>
      <View style={styles.row}>
        {AVATAR_SHAPES.map((item) => (
          <Chip
            key={item}
            label={item}
            selected={shape === item}
            onPress={() => setShape(item)}
          />
        ))}
      </View>
      <Text style={styles.section}>Model override</Text>
      <Pressable onPress={() => setModel("")} style={styles.option}>
        <Text style={styles.body}>
          Workspace default
          {modelsQuery.data?.defaultModelId
            ? ` (${modelsQuery.data.defaultModelId})`
            : ""}
        </Text>
      </Pressable>
      {PROVIDER_ORDER.map((provider) => {
        const options = catalog.filter((item) => item.provider === provider);
        if (options.length === 0) return null;
        return (
          <View key={provider}>
            <Text style={styles.meta}>{catalogGroupLabel(provider)}</Text>
            {options.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setModel(item.id)}
                style={styles.option}
              >
                <Text style={model === item.id ? styles.on : styles.body}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        );
      })}
      <Pressable
        onPress={() => setModel(CUSTOM_MODEL_SENTINEL)}
        style={styles.option}
      >
        <Text style={styles.body}>Custom model id</Text>
      </Pressable>
      {model === CUSTOM_MODEL_SENTINEL ? (
        <Field
          label="Model id"
          value={customModel}
          onChangeText={setCustomModel}
        />
      ) : null}
      <Button label="Save" onPress={() => void save()} busy={busy} />
      <Button
        label={pinned ? "Unpin" : "Pin"}
        tone="ghost"
        onPress={() => void togglePin()}
      />
      <Button
        label={bot.archivedAt ? "Unarchive" : "Archive"}
        tone="ghost"
        onPress={() => void archive()}
      />
      <Button label="Delete" tone="danger" onPress={confirmDelete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  swatchOn: { borderWidth: 2, borderColor: colors.white },
  section: { color: colors.text, fontWeight: "700", marginTop: 8 },
  option: { paddingVertical: 8 },
  body: { color: colors.text },
  meta: { color: colors.muted, marginTop: 8 },
  on: { color: colors.accent, fontWeight: "700" },
});
