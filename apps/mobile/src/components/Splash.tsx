import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "../theme";
import { Mascot } from "./Mascot";

const TEAM = [
  { name: "Ada", color: "#e45c9a", shape: "circle" as const },
  { name: "Sam", color: "#5b7cff", shape: "squircle" as const },
  { name: "Kai", color: "#2f9e6d", shape: "hex" as const },
];

export function Splash() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const lift = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      lift.setValue(0);
      return;
    }
    Animated.timing(lift, {
      toValue: 0,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [lift, reduceMotion]);

  return (
    <View
      style={styles.splash}
      accessibilityRole="progressbar"
      accessibilityLabel="Opening Groxbot"
    >
      <Animated.View
        style={[styles.mark, { transform: [{ translateY: lift }] }]}
      >
        <View
          style={styles.faces}
          importantForAccessibility="no-hide-descendants"
        >
          {TEAM.map((face, index) => (
            <View
              key={face.name}
              style={[
                styles.face,
                index > 0 ? styles.faceOverlap : null,
                { zIndex: index + 1 },
              ]}
            >
              <Mascot
                size={32}
                mood="idle"
                color={face.color}
                shape={face.shape}
                paintId={`boot-${face.name.toLowerCase()}`}
              />
            </View>
          ))}
        </View>
        <Text style={styles.word}>Groxbot</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  mark: {
    alignItems: "center",
    gap: 14,
  },
  faces: {
    flexDirection: "row",
    alignItems: "center",
  },
  face: {
    width: 32,
    height: 32,
    zIndex: 1,
  },
  faceOverlap: {
    marginLeft: -10,
  },
  word: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
});
