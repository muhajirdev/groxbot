import { SymbolView, type SFSymbol } from "expo-symbols";
import { Animated, Pressable, Text } from "react-native";
import { tapSoft } from "../lib/haptics";
import { colors } from "../theme";
import { usePressScale } from "./Motion";

export function HeaderButton({
  label,
  symbol,
  onPress,
  accessibilityLabel,
  align = "end",
}: {
  label: string;
  symbol?: SFSymbol;
  onPress: () => void;
  accessibilityLabel?: string;
  align?: "start" | "end";
}) {
  const press = usePressScale(0.88);
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        hitSlop={8}
        onPress={onPress}
        onPressIn={() => {
          press.onPressIn();
          tapSoft();
        }}
        onPressOut={press.onPressOut}
        style={{
          minHeight: 44,
          minWidth: 44,
          justifyContent: "center",
          alignItems: align === "start" ? "flex-start" : "flex-end",
        }}
      >
        {symbol ? (
          <SymbolView
            name={symbol}
            tintColor={colors.accent}
            size={22}
            resizeMode="scaleAspectFit"
          />
        ) : (
          <Text style={{ color: colors.text, fontSize: 17 }}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
