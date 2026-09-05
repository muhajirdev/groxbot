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
  const solid = tone === "accent";
  const danger = tone === "danger";
  const bg = solid ? colors.text : danger ? colors.danger : "transparent";
  const fg = solid ? colors.bg : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: disabled || busy ? 0.5 : 1 },
        tone === "ghost" ? styles.ghost : null,
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
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ghost: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: { fontSize: 15, fontWeight: "500" },
});
