import {
  type PresentNode,
  presentPreview,
  sanitizePresentTree,
} from "@groxbot/contracts";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

export function PresentCard(props: { tree: unknown }) {
  const tree = sanitizePresentTree(props.tree);
  if (!tree) return null;
  return (
    <View style={styles.root} accessibilityLabel={presentPreview(tree)}>
      <PresentNodeView node={tree} />
    </View>
  );
}

function presentNodeKey(node: PresentNode): string {
  const bits = [node.$type, node.title, node.label, node.value, node.text]
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean);
  return bits.join(":") || node.$type;
}

function PresentNodeView(props: { node: PresentNode }) {
  const { node } = props;
  const kids = (node.children ?? []).map((child) => (
    <PresentNodeView key={presentNodeKey(child)} node={child} />
  ));
  if (node.$type === "Card") {
    return (
      <View style={styles.card}>
        {typeof node.title === "string" && node.title.trim() ? (
          <Text style={styles.muted}>{node.title}</Text>
        ) : null}
        {kids}
      </View>
    );
  }
  if (node.$type === "Fact") {
    return (
      <View style={styles.fact}>
        <Text style={styles.muted}>{String(node.label ?? "")}</Text>
        <Text style={styles.value}>{String(node.value ?? "")}</Text>
      </View>
    );
  }
  if (
    node.$type === "Header" ||
    node.$type === "Text" ||
    node.$type === "Caption"
  ) {
    const text = String(node.text ?? node.value ?? "");
    if (!text) return kids.length ? <View>{kids}</View> : null;
    return (
      <Text style={node.$type === "Caption" ? styles.muted : styles.body}>
        {text}
      </Text>
    );
  }
  if (node.$type === "Table") {
    return <Text style={styles.body}>{presentPreview(node) || "Table"}</Text>;
  }
  if (kids.length) return <View style={styles.stack}>{kids}</View>;
  const preview = presentPreview(node);
  return preview ? <Text style={styles.body}>{preview}</Text> : null;
}

const styles = StyleSheet.create({
  root: { maxWidth: 280, gap: 8 },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    gap: 8,
  },
  stack: { gap: 6 },
  fact: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  muted: { color: colors.muted, fontSize: 12 },
  value: { color: colors.text, fontSize: 14, fontVariant: ["tabular-nums"] },
  body: { color: colors.text, fontSize: 14 },
});
