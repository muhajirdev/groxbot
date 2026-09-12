import type { MascotShape } from "@groxbot/mascot";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { Float, PopIn } from "./Motion";
import { Mascot } from "./Mascot";

const PALS: {
  name: string;
  color: string;
  shape: MascotShape;
  size: number;
  rotate: string;
  side: "left" | "right";
}[] = [
  {
    name: "Ada",
    color: "#5b7cff",
    shape: "squircle",
    size: 58,
    rotate: "-12deg",
    side: "left",
  },
  {
    name: "Kai",
    color: "#2f9e6d",
    shape: "hex",
    size: 52,
    rotate: "14deg",
    side: "right",
  },
];

export function AuthGlow() {
  return (
    <View style={styles.glow} accessibilityElementsHidden>
      <View style={[styles.orb, styles.orbPink]} />
      <View style={[styles.orb, styles.orbBlue]} />
      <View style={[styles.orb, styles.orbMint]} />
    </View>
  );
}

export function BuddyPile({
  mood = "happy",
}: {
  mood?: "idle" | "thinking" | "working" | "happy";
}) {
  return (
    <View style={styles.pile} accessibilityLabel="Groxbot and friends">
      {PALS.map((pal) => (
        <View
          key={pal.name}
          style={[
            styles.pal,
            pal.side === "left" ? styles.palLeft : styles.palRight,
            { transform: [{ rotate: pal.rotate }] },
          ]}
        >
          <Mascot
            size={pal.size}
            mood="idle"
            color={pal.color}
            shape={pal.shape}
            paintId={`pal-${pal.name.toLowerCase()}`}
          />
        </View>
      ))}
      <Float>
        <PopIn delay={60}>
          <Mascot size={104} mood={mood} paintId="auth-hero" />
        </PopIn>
      </Float>
    </View>
  );
}

export function FunChip({
  label,
  tint,
}: {
  label: string;
  tint: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: tint }]}>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    ...StyleSheet.absoluteFill,
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  orbPink: {
    width: 280,
    height: 280,
    top: -90,
    right: -70,
    backgroundColor: "#e45c9a",
    opacity: 0.16,
  },
  orbBlue: {
    width: 240,
    height: 240,
    top: 160,
    left: -110,
    backgroundColor: "#5b7cff",
    opacity: 0.16,
  },
  orbMint: {
    width: 200,
    height: 200,
    bottom: 40,
    right: -40,
    backgroundColor: "#2f9e6d",
    opacity: 0.12,
  },
  pile: {
    height: 148,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  pal: {
    position: "absolute",
    top: 36,
    zIndex: 1,
  },
  palLeft: { left: 24 },
  palRight: { right: 24 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
});
