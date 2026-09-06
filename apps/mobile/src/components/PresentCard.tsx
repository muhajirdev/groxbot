import {
  type PresentNode,
  presentPreview,
  sanitizePresentTree,
} from "@groxbot/contracts";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Polyline, Rect } from "react-native-svg";
import {
  type PresentChartPoint,
  presentChart,
  presentFileOpen,
  presentFilePlace,
  presentFileTitle,
  presentImageSrc,
  presentNodeText,
  presentTable,
} from "../lib/present";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";
import { ChatMarkdown } from "./ChatMarkdown";

const CHART_WIDTH = 100;
const CHART_HEIGHT = 40;

export function PresentCard(props: { tree: unknown; botId?: string }) {
  const tree = sanitizePresentTree(props.tree);
  if (!tree) return null;
  return (
    <View style={styles.root} accessibilityLabel={presentPreview(tree)}>
      <PresentNodeView node={tree} botId={props.botId} />
    </View>
  );
}

function presentNodeKey(node: PresentNode): string {
  const bits = [
    node.$type,
    node.title,
    node.label,
    node.value,
    node.text,
    node.path,
  ]
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean);
  return bits.join(":") || node.$type;
}

function PresentNodeView(props: { node: PresentNode; botId?: string }) {
  const { node, botId } = props;
  const kids = (node.children ?? []).map((child) => (
    <PresentNodeView key={presentNodeKey(child)} node={child} botId={botId} />
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
    const text = presentNodeText(node);
    if (!text) {
      return kids.length ? <View style={styles.stack}>{kids}</View> : null;
    }
    return (
      <Text style={node.$type === "Caption" ? styles.muted : styles.body}>
        {text}
      </Text>
    );
  }
  if (node.$type === "Badge") {
    const text = presentNodeText(node);
    if (!text) return null;
    return <Text style={styles.badge}>{text}</Text>;
  }
  if (node.$type === "Alert") {
    const tone = node.tone === "danger" || node.tone === "error";
    return (
      <View style={[styles.alert, tone ? styles.alertDanger : null]}>
        {typeof node.title === "string" && node.title.trim() ? (
          <Text style={styles.body}>{node.title}</Text>
        ) : null}
        {typeof node.description === "string" && node.description.trim() ? (
          <Text style={styles.muted}>{node.description}</Text>
        ) : null}
        {kids}
      </View>
    );
  }
  if (node.$type === "Table") {
    return <PresentTable node={node} />;
  }
  if (node.$type === "Chart") {
    return <PresentChart node={node} />;
  }
  if (node.$type === "Image") {
    return (
      <PresentImage
        src={presentImageSrc(node.src)}
        alt={presentNodeText(node) || "Image"}
      />
    );
  }
  if (node.$type === "File") {
    return <PresentFile node={node} botId={botId} />;
  }
  if (node.$type === "Markdown") {
    const text = presentNodeText(node);
    if (text) return <ChatMarkdown text={text} />;
    return kids.length ? <View>{kids}</View> : null;
  }
  if (node.$type === "Divider") {
    return <View style={styles.divider} />;
  }
  if (node.$type === "Row") {
    return <View style={styles.row}>{kids}</View>;
  }
  if (
    node.$type === "Col" ||
    node.$type === "Box" ||
    node.$type === "ListView"
  ) {
    return <View style={styles.stack}>{kids}</View>;
  }
  if (node.$type === "ListViewItem") {
    return <View style={styles.listItem}>{kids}</View>;
  }
  if (node.$type === "Carousel") {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
      >
        {kids}
      </ScrollView>
    );
  }
  if (node.$type === "Button") {
    const label =
      typeof node.label === "string" && node.label.trim()
        ? node.label.trim()
        : presentNodeText(node);
    return label ? <Text style={styles.button}>{label}</Text> : null;
  }
  if (kids.length) return <View style={styles.stack}>{kids}</View>;
  const preview = presentPreview(node);
  return preview ? <Text style={styles.body}>{preview}</Text> : null;
}

function PresentFile(props: { node: PresentNode; botId?: string }) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const path = typeof props.node.path === "string" ? props.node.path : "";
  const place = presentFilePlace(props.node.place);
  const title = presentFileTitle(props.node);
  const canOpen =
    Boolean(path) && (place === "knowledge" || Boolean(props.botId));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${place === "knowledge" ? "Knowledge" : "Computer"}`}
      disabled={!canOpen}
      onPress={() => {
        if (!path) return;
        const dest = presentFileOpen(props.botId ?? "", path, place);
        if (dest.screen === "Knowledge") {
          navigation.navigate("Knowledge", { path: dest.path });
          return;
        }
        if (!dest.botId) return;
        navigation.navigate("Computer", { botId: dest.botId, path: dest.path });
      }}
      style={styles.file}
    >
      <Text style={styles.body}>{title}</Text>
      <Text style={styles.muted}>
        {place === "knowledge" ? "Knowledge" : "Computer"}
      </Text>
    </Pressable>
  );
}

function PresentImage(props: { src: string | null; alt: string }) {
  const [open, setOpen] = useState(false);
  if (!props.src) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Click to zoom image"
        onPress={() => setOpen(true)}
      >
        <Image
          source={{ uri: props.src }}
          style={styles.image}
          accessibilityLabel={props.alt}
          resizeMode="cover"
        />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.zoom}
          onPress={() => setOpen(false)}
          accessibilityLabel="Zoomed image"
          accessibilityRole="button"
        >
          <Image
            source={{ uri: props.src }}
            style={styles.zoomImage}
            accessibilityLabel={props.alt}
            resizeMode="contain"
          />
        </Pressable>
      </Modal>
    </>
  );
}

function PresentTable(props: { node: PresentNode }) {
  const { columns, rows } = presentTable(props.node);
  if (columns.length === 0 && rows.length === 0) {
    return (
      <Text style={styles.body}>{presentPreview(props.node) || "Table"}</Text>
    );
  }
  return (
    <View>
      {columns.length ? (
        <View style={styles.tr}>
          {columns.map((label) => (
            <Text key={`h:${label}`} style={[styles.td, styles.th]}>
              {label}
            </Text>
          ))}
        </View>
      ) : null}
      {rows.map((row) => (
        <View key={`r:${row.join("\u001f")}`} style={styles.tr}>
          {row.map((cell) => (
            <Text key={`c:${cell}`} style={styles.td}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function chartBarMarks(
  points: PresentChartPoint[],
  max: number,
  slot: number,
  gap: number,
  barWidth: number,
) {
  const bars = [];
  for (const point of points) {
    const slotIndex = bars.length;
    const height = max > 0 ? (point.value / max) * CHART_HEIGHT : 0;
    bars.push(
      <Rect
        key={`bar:${point.label}:${point.value}:${slotIndex}`}
        x={slotIndex * slot + gap / 2}
        y={CHART_HEIGHT - height}
        width={barWidth}
        height={height}
        fill={colors.accent}
      />,
    );
  }
  return bars;
}

function PresentChart(props: { node: PresentNode }) {
  const { variant, points } = presentChart(props.node);
  const n = points.length;
  const max = points.reduce((acc, point) => Math.max(acc, point.value), 0);
  const slot = n > 0 ? CHART_WIDTH / n : 0;
  const gap = slot * 0.2;
  const barWidth = slot - gap;
  const yFor = (value: number) =>
    max > 0 ? CHART_HEIGHT - (value / max) * CHART_HEIGHT : CHART_HEIGHT;
  const linePoints =
    n > 1
      ? points
          .map(
            (point, index) =>
              `${(index / (n - 1)) * CHART_WIDTH},${yFor(point.value)}`,
          )
          .join(" ")
      : "";
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${variant} chart with ${n} data points`}
    >
      <Svg
        width="100%"
        height={88}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
      >
        {variant === "bar" ? (
          chartBarMarks(points, max, slot, gap, barWidth)
        ) : n === 1 ? (
          <Circle
            cx={CHART_WIDTH / 2}
            cy={yFor(points[0]?.value ?? 0)}
            r={2}
            fill={colors.accent}
          />
        ) : n > 1 ? (
          <Polyline
            points={linePoints}
            fill="none"
            stroke={colors.accent}
            strokeWidth={1.5}
          />
        ) : null}
      </Svg>
      {points.some((point) => point.label) ? (
        <View style={styles.chartLabels}>
          {points.map((point) => (
            <Text key={point.label} style={styles.chartLabel}>
              {point.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
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
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  carousel: { gap: 10, flexDirection: "row" },
  fact: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  muted: { color: colors.muted, fontSize: 12 },
  value: { color: colors.text, fontSize: 14, fontVariant: ["tabular-nums"] },
  body: { color: colors.text, fontSize: 14 },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    color: colors.text,
    fontSize: 12,
  },
  alert: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  alertDanger: { borderColor: colors.danger },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: 4,
  },
  listItem: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: colors.text,
    color: colors.bg,
    borderRadius: radius.pill,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: "500",
  },
  file: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
  },
  image: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    backgroundColor: colors.surface2,
  },
  zoom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  zoomImage: { width: "100%", height: "90%" },
  tr: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  th: { color: colors.muted, fontSize: 12 },
  td: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  chartLabel: { color: colors.muted, fontSize: 11, flex: 1 },
});
