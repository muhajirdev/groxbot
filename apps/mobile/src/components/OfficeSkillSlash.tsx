import { useAui, useAuiState } from "@assistant-ui/react-native";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { matchOfficeSkills, officeSkills } from "../lib/knowledge-tree";
import { orpc } from "../lib/orpc";
import { colors } from "../theme";

export function OfficeSkillSlash() {
  const aui = useAui();
  const value = useAuiState((s) => s.composer.text);
  const listing = useQuery({
    ...orpc.knowledge.list.queryOptions(),
    enabled: value.trimStart().startsWith("/"),
  });
  const hits = matchOfficeSkills(
    value,
    officeSkills(listing.data?.entries ?? []),
  ).slice(0, 8);
  if (hits.length === 0) return null;
  return (
    <View style={styles.list} accessibilityRole="list">
      {hits.map((skill) => (
        <Pressable
          key={skill.name}
          accessibilityRole="button"
          onPress={() => aui.composer.setText(`/${skill.name} `)}
          style={styles.item}
        >
          <Text style={styles.name}>/{skill.name}</Text>
          {skill.description ? (
            <Text style={styles.desc} numberOfLines={1}>
              {skill.description}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 6,
  },
  item: { paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  name: { color: colors.text, fontWeight: "700" },
  desc: { color: colors.muted, fontSize: 12 },
});
