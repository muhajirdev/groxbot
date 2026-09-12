import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { tapSelect } from "../lib/haptics";
import { colors, radius } from "../theme";
import { usePressScale } from "./Motion";

export function Chip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => {
          press.onPressIn();
          tapSelect();
        }}
        onPressOut={press.onPressOut}
        style={[styles.chip, selected ? styles.on : null]}
      >
        <Text style={[styles.label, selected ? styles.onLabel : null]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
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
