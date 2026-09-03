import type { AvatarShape } from "@groxbot/contracts";
import {
  type MascotMood,
  type MascotShape,
  mascotMarkSvg,
} from "@groxbot/mascot";
import { useEffect, useId, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";
import { colors } from "../theme";

export function Avatar({
  name = "Groxbot",
  color,
  shape,
  mood = "idle",
  size = 40,
  working,
}: {
  name?: string;
  color: string;
  shape: AvatarShape | MascotShape | string;
  mood?: MascotMood;
  size?: number;
  working?: boolean;
}) {
  const paintId = useId().replace(/:/g, "");
  const bounce = useRef(new Animated.Value(0)).current;
  const xml = mascotMarkSvg({
    name,
    color,
    shape: shape as MascotShape,
    mood: working ? "working" : mood,
    paintId,
  });

  useEffect(() => {
    if (!working) {
      bounce.stopAnimation();
      bounce.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -4,
          duration: 280,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 280,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      bounce.setValue(0);
    };
  }, [bounce, working]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: shape === "circle" ? size / 2 : 10,
          transform: [{ translateY: bounce }],
        },
      ]}
    >
      <SvgXml xml={xml} width={size} height={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
});
