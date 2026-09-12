import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors } from "../theme";

export function Screen({
  children,
  scroll,
  edges = ["left", "right", "bottom"],
  safe = true,
  backdrop,
  align = "start",
}: {
  children?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  /** False = no SafeArea wrap; the stack header owns the top inset. */
  safe?: boolean;
  backdrop?: ReactNode;
  align?: "start" | "center";
}) {
  const body = scroll ? (
    <ScrollView
      style={safe ? undefined : styles.safe}
      contentContainerStyle={[
        styles.scroll,
        align === "center" ? styles.scrollCenter : null,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );

  if (!safe) return body;

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {backdrop ? (
        <View pointerEvents="none" style={styles.backdrop}>
          {backdrop}
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  scroll: { padding: 20, paddingBottom: 40, gap: 14 },
  scrollCenter: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: 28,
    gap: 18,
  },
});
