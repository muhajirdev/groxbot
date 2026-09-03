import * as Linking from "expo-linking";
import { Fragment, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  type MdInline,
  parseChatMarkdown,
  safeMarkdownUrl,
} from "../lib/chat-markdown";
import { parseKnowledgeHref } from "../lib/knowledge-link";
import { colors } from "../theme";

export function ChatMarkdown(props: {
  text: string;
  officePaths?: boolean;
  onOpenPath?: (path: string) => void;
}) {
  const blocks = parseChatMarkdown(props.text);
  if (blocks.length === 0) return null;
  return (
    <View style={styles.stack}>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        if (block.kind === "code") {
          return (
            <Text key={key} style={styles.code}>
              {block.text}
            </Text>
          );
        }
        if (block.kind === "ul" || block.kind === "ol") {
          return (
            <View key={key} style={styles.list}>
              {block.items.map((item, itemIndex) => (
                <View
                  key={item
                    .map((node) =>
                      node.kind === "link" ? node.href : node.text,
                    )
                    .join("|")}
                  style={styles.li}
                >
                  <Text style={styles.bullet}>
                    {block.kind === "ol" ? `${itemIndex + 1}.` : "•"}
                  </Text>
                  <Text style={styles.body}>
                    <Inlines
                      nodes={item}
                      officePaths={props.officePaths}
                      onOpenPath={props.onOpenPath}
                    />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        const inlines = (
          <Inlines
            nodes={block.inlines}
            officePaths={props.officePaths}
            onOpenPath={props.onOpenPath}
          />
        );
        if (block.kind === "h") {
          return (
            <Text key={key} style={block.level === 1 ? styles.h1 : styles.h2}>
              {inlines}
            </Text>
          );
        }
        if (block.kind === "quote") {
          return (
            <Text key={key} style={styles.quote}>
              {inlines}
            </Text>
          );
        }
        return (
          <Text key={key} style={styles.body}>
            {inlines}
          </Text>
        );
      })}
    </View>
  );
}

function Inlines(props: {
  nodes: MdInline[];
  officePaths?: boolean;
  onOpenPath?: (path: string) => void;
}): ReactNode {
  return props.nodes.map((node, index) => {
    const key = `${node.kind}-${index}`;
    if (node.kind === "strong") {
      return (
        <Text key={key} style={styles.strong}>
          {node.text}
        </Text>
      );
    }
    if (node.kind === "em") {
      return (
        <Text key={key} style={styles.em}>
          {node.text}
        </Text>
      );
    }
    if (node.kind === "code") {
      return (
        <Text key={key} style={styles.inlineCode}>
          {node.text}
        </Text>
      );
    }
    if (node.kind === "link") {
      const parsed = parseKnowledgeHref(node.href);
      if (parsed.kind === "external") {
        const href = safeMarkdownUrl(parsed.href);
        if (!href) return <Fragment key={key}>{node.text}</Fragment>;
        return (
          <Text
            key={key}
            style={styles.link}
            onPress={() => void Linking.openURL(href)}
          >
            {node.text}
          </Text>
        );
      }
      if (props.officePaths && parsed.kind === "path" && props.onOpenPath) {
        return (
          <Text
            key={key}
            style={styles.link}
            onPress={() => props.onOpenPath?.(parsed.path)}
          >
            {node.text}
          </Text>
        );
      }
      return <Fragment key={key}>{node.text}</Fragment>;
    }
    return <Fragment key={key}>{node.text}</Fragment>;
  });
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  body: { color: colors.text, fontSize: 16, lineHeight: 24 },
  h1: { color: colors.text, fontSize: 20, fontWeight: "700", lineHeight: 26 },
  h2: { color: colors.text, fontSize: 17, fontWeight: "700", lineHeight: 24 },
  quote: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    borderLeftWidth: 2,
    borderLeftColor: colors.line,
    paddingLeft: 10,
  },
  code: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 13,
    backgroundColor: colors.surface2,
    padding: 10,
    borderRadius: 8,
  },
  list: { gap: 4 },
  li: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bullet: { color: colors.muted, width: 18, lineHeight: 24 },
  strong: { fontWeight: "700" },
  em: { fontStyle: "italic" },
  inlineCode: {
    fontFamily: "monospace",
    backgroundColor: colors.surface2,
    fontSize: 14,
  },
  link: { color: colors.accent, fontWeight: "600" },
});
