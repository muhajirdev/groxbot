import { ActivityIndicator, Animated, Pressable, StyleSheet, Text } from "react-native";
import { tapSoft } from "../lib/haptics";
import { colors, radius } from "../theme";
import { usePressScale } from "./Motion";

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
  tone?: "accent" | "ghost" | "danger" | "brand";
}) {
  const press = usePressScale();
  const brand = tone === "brand";
  const solid = tone === "accent";
  const danger = tone === "danger";
  const bg = brand
    ? colors.accent
    : solid
      ? colors.text
      : danger
        ? colors.danger
        : "transparent";
  const fg = brand || danger ? colors.accentInk : solid ? colors.bg : colors.text;
  const blocked = disabled || busy;
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => {
          if (blocked) return;
          press.onPressIn();
          tapSoft();
        }}
        onPressOut={press.onPressOut}
        disabled={blocked}
        style={[
          styles.btn,
          { backgroundColor: bg, opacity: blocked ? 0.5 : 1 },
          tone === "ghost" ? styles.ghost : null,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    borderRadius: radius.pill,
    borderCurve: "continuous",
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
