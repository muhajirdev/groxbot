import type { MascotShape } from "@groxbot/mascot";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { AuthGlow } from "./AuthScene";
import { Appear, Breathe } from "./Motion";
import { Mascot } from "./Mascot";

const TEAM: {
  name: string;
  color: string;
  shape: MascotShape;
  x: number;
  y: number;
  rotate: string;
}[] = [
  {
    name: "Ada",
    color: "#e45c9a",
    shape: "circle",
    x: -28,
    y: 6,
    rotate: "-8deg",
  },
  {
    name: "Sam",
    color: "#5b7cff",
    shape: "squircle",
    x: 0,
    y: -8,
    rotate: "4deg",
  },
  {
    name: "Kai",
    color: "#2f9e6d",
    shape: "hex",
    x: 28,
    y: 8,
    rotate: "10deg",
  },
];

export function Splash() {
  return (
    <View
      style={styles.splash}
      accessibilityRole="progressbar"
      accessibilityLabel="Opening Groxbot"
    >
      <Breathe>
        <AuthGlow />
      </Breathe>
      <View style={styles.mark}>
        <View
          style={styles.cluster}
          importantForAccessibility="no-hide-descendants"
        >
          {TEAM.map((face, index) => (
            <Appear
              key={face.name}
              delay={40 + index * 70}
              style={[styles.face, { zIndex: index + 1 }]}
            >
              <View
                style={{
                  transform: [
                    { translateX: face.x },
                    { translateY: face.y },
                    { rotate: face.rotate },
                  ],
                }}
              >
                <Mascot
                  size={40}
                  mood="happy"
                  color={face.color}
                  shape={face.shape}
                  paintId={`boot-${face.name.toLowerCase()}`}
                />
              </View>
            </Appear>
          ))}
        </View>
        <Appear delay={280}>
          <Text style={styles.word}>Groxbot</Text>
        </Appear>
      </View>
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
    overflow: "hidden",
  },
  mark: {
    alignItems: "center",
    gap: 18,
  },
  cluster: {
    width: 132,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    position: "absolute",
    width: 40,
    height: 40,
  },
  word: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
});
