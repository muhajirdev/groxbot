import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tapSelect } from "../lib/haptics";
import { colors } from "../theme";

export function Sheet({
  open,
  title,
  onClose,
  children,
  scroll,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={[styles.stack, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.card}>
            <View style={styles.handle} />
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {body}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function SheetRow({
  label,
  hint,
  onPress,
  tone = "default",
  selected,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  tone?: "default" | "danger" | "muted";
  selected?: boolean;
}) {
  const color =
    tone === "danger"
      ? colors.danger
      : selected
        ? colors.accent
        : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tapSelect();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowCopy}>
        <Text
          style={[styles.label, { color }, selected ? styles.selected : null]}
        >
          {label}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {selected ? <Text style={styles.check}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "flex-end",
  },
  stack: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    overflow: "hidden",
    maxHeight: "72%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface2,
    marginTop: 8,
    marginBottom: 4,
  },
  scroll: { maxHeight: 400 },
  title: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 10,
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  rowCopy: { flex: 1, gap: 2 },
  pressed: { backgroundColor: colors.surface2 },
  label: { fontSize: 17, fontWeight: "400" },
  selected: { fontWeight: "600" },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  check: { color: colors.accent, fontSize: 16, fontWeight: "700" },
  cancel: {
    backgroundColor: colors.card,
    borderRadius: 14,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelLabel: { color: colors.text, fontSize: 17, fontWeight: "600" },
});
