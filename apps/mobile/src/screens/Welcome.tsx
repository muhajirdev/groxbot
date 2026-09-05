import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Mascot } from "../components/Mascot";
import { Screen } from "../components/Screen";
import { colors, type } from "../theme";

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={type.kicker}>Welcome to Groxbot</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Meet</Text>
          <Mascot size={36} />
          <Text style={styles.title}>Groxbot</Text>
        </View>
        <Text style={styles.lede}>Like Grok Bot, for the whole team.</Text>
        <Text style={styles.thesis}>
          Give work the way you would a coworker. They pick it up and comment
          when done.
        </Text>
        <Text style={styles.note}>
          Each Bot already has a computer. You can ignore it until you need the
          screen.
        </Text>
        <Button label="Get started" onPress={onStart} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 14, paddingTop: 36 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "600",
    letterSpacing: -0.8,
  },
  lede: { color: colors.text, fontSize: 18, lineHeight: 26 },
  thesis: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    opacity: 0.82,
  },
  note: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 8 },
});
