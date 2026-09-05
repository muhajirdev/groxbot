import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Mascot } from "../components/Mascot";
import { Screen } from "../components/Screen";
import { colors } from "../theme";

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.badge}>Fair-code · For the team</Text>
        <Mascot size={88} />
        <Text style={styles.title}>Meet Groxbot</Text>
        <Text style={styles.lede}>
          Named AI teammates you message like people. Each has a real computer.
          The whole team sits in one office.
        </Text>
        <Text style={styles.thesis}>
          Self-host it, or use groxbot.com. No workflow builder.
        </Text>
        <Button label="Get started" onPress={onStart} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 14, paddingTop: 48 },
  badge: {
    color: colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: 11,
  },
  title: { color: colors.text, fontSize: 34, fontWeight: "700" },
  lede: { color: colors.text, fontSize: 18 },
  thesis: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
});
