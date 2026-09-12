import type { AvatarShape } from "@groxbot/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tapSoft } from "../lib/haptics";
import { colors } from "../theme";
import { Avatar } from "./Avatar";

export function ThreadTitle({
  name,
  color,
  shape,
  onPress,
}: {
  name: string;
  color?: string;
  shape?: AvatarShape | string;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.pill}>
      {color ? (
        <Avatar
          name={name}
          color={color}
          shape={shape || "circle"}
          size={22}
        />
      ) : null}
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} settings`}
      onPress={() => {
        tapSoft();
        onPress();
      }}
      hitSlop={6}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 220,
    minHeight: 34,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
});
