import type { TemplateId } from "@groxbot/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { APP_KIND_COLOR, APP_KIND_LABEL } from "../lib/app-kind";
import { colors, radius } from "../theme";

export function AppCard({
  templateId,
  title,
  onOpen,
}: {
  templateId: TemplateId;
  title: string;
  onOpen: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View
          style={[styles.dot, { backgroundColor: APP_KIND_COLOR[templateId] }]}
        />
        <Text style={styles.kind}>{APP_KIND_LABEL[templateId]}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={styles.open}
      >
        <Text style={styles.openLabel}>Open</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    gap: 8,
    maxWidth: 280,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  kind: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  open: {
    alignSelf: "flex-start",
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  openLabel: { color: colors.bg, fontWeight: "500", fontSize: 13 },
});
