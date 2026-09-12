import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tapSelect } from "../lib/haptics";
import { colors } from "../theme";

export function SettingsGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function SettingsRow({
  label,
  value,
  onPress,
  last,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const body = (
    <View style={[styles.row, last ? null : styles.line]}>
      <Text style={styles.label}>{label}</Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tapSelect();
        onPress();
      }}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    gap: 10,
  },
  line: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  label: { color: colors.text, fontSize: 17, flexShrink: 0 },
  value: { color: colors.muted, fontSize: 17, flex: 1, textAlign: "right" },
  chevron: { color: colors.faint, fontSize: 22, lineHeight: 24, marginTop: -2 },
  pressed: { backgroundColor: colors.surface2 },
});
