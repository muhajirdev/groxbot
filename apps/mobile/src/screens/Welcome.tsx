import { StyleSheet, Text, View } from "react-native";
import { AuthGlow, BuddyPile, FunChip } from "../components/AuthScene";
import { Button } from "../components/Button";
import { FadeUpStack } from "../components/Motion";
import { Screen } from "../components/Screen";
import { colors } from "../theme";

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <Screen
      scroll
      align="center"
      edges={["top", "left", "right", "bottom"]}
      backdrop={<AuthGlow />}
    >
      <FadeUpStack>
        <BuddyPile />
        <Text style={styles.kicker}>Welcome to Groxbot</Text>
        <Text style={styles.title}>Hey. Your office{"\n"}just got livelier.</Text>
        <Text style={styles.lede}>
          Hire teammates who pick work up, use their own computer, and ping you
          when it’s done.
        </Text>
        <View style={styles.chips}>
          <FunChip label="Own computer" tint="#e45c9a33" />
          <FunChip label="Real threads" tint="#5b7cff33" />
          <FunChip label="They finish it" tint="#2f9e6d33" />
        </View>
        <Button label="Let's go" tone="brand" onPress={onStart} />
      </FadeUpStack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 40,
  },
  lede: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 25,
    opacity: 0.82,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
});
