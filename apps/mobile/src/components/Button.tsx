import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radius } from "../theme";

export function Button({
  label,
  onPress,
  disabled,
  busy,
  tone = "accent",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: "accent" | "ghost" | "danger";
}) {
  const bg =
    tone === "accent"
      ? colors.accent
      : tone === "danger"
        ? colors.danger
        : colors.surface2;
  const fg = tone === "accent" ? colors.accentInk : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: disabled || busy ? 0.5 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  label: { fontSize: 16, fontWeight: "600" },
});
