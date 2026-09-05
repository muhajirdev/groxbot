import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius } from "../theme";

export function Chip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected ? styles.on : null]}
    >
      <Text style={[styles.label, selected ? styles.onLabel : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  on: {
    backgroundColor: colors.card,
    borderColor: colors.accent,
  },
  label: { color: colors.text, fontSize: 13, fontWeight: "500" },
  onLabel: { color: colors.text },
});
