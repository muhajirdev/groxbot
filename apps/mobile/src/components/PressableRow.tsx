import type { ReactNode } from "react";
import {
  Animated,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { tapLight } from "../lib/haptics";
import { colors } from "../theme";
import { usePressScale } from "./Motion";

export function PressableRow({
  children,
  onPress,
  onLongPress,
  style,
  highlight,
  scale,
  haptic,
  accessibilityLabel,
  accessibilityRole = "button",
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  highlight?: boolean;
  scale?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "checkbox";
}) {
  const press = usePressScale();
  return (
    <Animated.View style={scale ? press.style : undefined}>
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => {
          if (scale) press.onPressIn();
          if (haptic) tapLight();
        }}
        onPressOut={press.onPressOut}
        style={({ pressed }) => [
          style,
          highlight && pressed ? { backgroundColor: colors.surface } : null,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
