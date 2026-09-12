import type { AvatarShape } from "@groxbot/contracts";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { Avatar } from "./Avatar";
import { FadeUp, PopIn } from "./Motion";
import { Mascot } from "./Mascot";

export function EmptyDesk({
  title,
  lede,
  name,
  color,
  shape,
  children,
}: {
  title: string;
  lede: string;
  name?: string;
  color?: string;
  shape?: AvatarShape | string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <PopIn>
        {color ? (
          <Avatar
            name={name}
            color={color}
            shape={shape || "circle"}
            size={72}
            mood="happy"
          />
        ) : (
          <Mascot size={88} mood="happy" />
        )}
      </PopIn>
      <FadeUp delay={70}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.lede}>{lede}</Text>
      </FadeUp>
      {children ? (
        <FadeUp delay={140}>
          <View style={styles.extra}>{children}</View>
        </FadeUp>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 8,
    gap: 14,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  lede: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 6,
  },
  extra: {
    width: "100%",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
});
