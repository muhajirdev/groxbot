import {
  BOT_MARKETPLACE_CATALOG,
  filterBotMarketplace,
  hireFieldsFromTemplate,
} from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { FadeUp, PopIn, Shake } from "../components/Motion";
import { PressableRow } from "../components/PressableRow";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import { tapError, tapSelect, tapSuccess } from "../lib/haptics";
import { nextAvatarColor, nextHireName } from "../lib/hire";
import { AVATAR_SHAPES } from "../lib/jobs";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Hire">;

function colorForName(name: string): string {
  const palette = ["#e45c9a", "#5b7cff", "#2f9e6d", "#d9a441", "#8b6ccf", "#3aa0b8"];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length] ?? "#e45c9a";
}

export function HireScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const botsQuery = useQuery(orpc.bots.list.queryOptions());
  const meQuery = useQuery(orpc.me.queryOptions());
  const [name, setName] = useState(nextHireName(botsQuery.data ?? []));
  const [asPrivate, setAsPrivate] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const templates = filterBotMarketplace(BOT_MARKETPLACE_CATALOG, search, null);
  const color = useMemo(
    () => nextAvatarColor(botsQuery.data ?? []),
    [botsQuery.data],
  );
  const shape = AVATAR_SHAPES[0] ?? "circle";

  async function hire(marketplaceId?: string) {
    const template = marketplaceId
      ? BOT_MARKETPLACE_CATALOG.find((row) => row.id === marketplaceId)
      : undefined;
    const fields = template ? hireFieldsFromTemplate(template) : null;
    const next = (fields?.name || name).trim();
    if (!next) return;
    setBusy(true);
    setError("");
    try {
      const bot = await client.bots.create({
        name: next,
        title: fields?.title,
        description: fields?.description,
        instructions: fields?.instructions,
        marketplaceId: fields?.marketplaceId,
        avatarColor: nextAvatarColor(botsQuery.data ?? []),
        visibility: asPrivate ? "private" : "shared",
      });
      tapSuccess();
      await queryClient.invalidateQueries({ queryKey: orpc.bots.list.key() });
      navigation.replace("Thread", { botId: bot.id });
    } catch (caught) {
      tapError();
      setError(userFacingError(caught, "Could not hire"));
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <FadeUp>
        <View style={styles.hero}>
          <PopIn>
            <Avatar
              name={name.trim() || "New"}
              color={color}
              shape={shape}
              size={72}
              mood="happy"
            />
          </PopIn>
          <Text style={styles.kicker}>New teammate</Text>
          <Text style={styles.title}>Who's joining?</Text>
        </View>
      </FadeUp>
      {meQuery.data?.needsModel ? (
        <Text style={styles.warn}>
          Add a model key in Settings before they can talk.
        </Text>
      ) : null}
      {error ? (
        <Shake trigger={error}>
          <Text style={styles.error}>{error}</Text>
        </Shake>
      ) : null}
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Piper"
        autoCapitalize="words"
      />
      <Pressable
        onPress={() => {
          tapSelect();
          setAsPrivate((value) => !value);
        }}
        style={styles.privateRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: asPrivate }}
        accessibilityLabel="Private"
      >
        <View style={[styles.box, asPrivate ? styles.boxOn : null]}>
          {asPrivate ? <Text style={styles.check}>✓</Text> : null}
        </View>
        <View style={styles.privateCopy}>
          <Text style={styles.privateLabel}>Private desk</Text>
          <Text style={styles.privateHint}>Only you can see this teammate.</Text>
        </View>
      </Pressable>
      <Button
        label={name.trim() ? `Hire ${name.trim()}` : "Hire"}
        tone="brand"
        onPress={() => void hire()}
        busy={busy}
        disabled={!name.trim()}
      />
      <Text style={styles.section}>Or pick a role</Text>
      <Field
        placeholder="Search roles"
        value={search}
        onChangeText={setSearch}
      />
      {templates.slice(0, 24).map((row) => (
        <PressableRow
          key={row.id}
          highlight
          haptic
          scale
          onPress={() => void hire(row.id)}
          style={styles.card}
        >
          <Avatar
            name={row.name}
            color={colorForName(row.name)}
            shape="squircle"
            size={40}
          />
          <View style={styles.cardCopy}>
            <Text style={styles.cardName}>{row.name}</Text>
            <Text style={styles.cardBlurb}>{row.blurb}</Text>
            <Text style={styles.cardMeta}>{row.category}</Text>
          </View>
        </PressableRow>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 8, paddingBottom: 8 },
  kicker: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 6,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  error: { color: colors.danger },
  warn: { color: colors.muted, lineHeight: 20 },
  privateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingVertical: 4,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  check: { color: colors.accentInk, fontSize: 13, fontWeight: "700" },
  privateCopy: { flex: 1, gap: 2 },
  privateLabel: { color: colors.text, fontSize: 16, fontWeight: "500" },
  privateHint: { color: colors.muted, fontSize: 13 },
  section: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 17,
    marginTop: 20,
    letterSpacing: -0.2,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  cardCopy: { flex: 1, minWidth: 0, gap: 3 },
  cardName: { color: colors.text, fontWeight: "600", fontSize: 16 },
  cardBlurb: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  cardMeta: { color: colors.faint, fontSize: 12, fontWeight: "600" },
});
