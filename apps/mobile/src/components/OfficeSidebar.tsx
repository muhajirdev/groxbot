import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import type { SFSymbol } from "expo-symbols";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userFacingError } from "../lib/errors";
import { tapLight, tapSelect } from "../lib/haptics";
import { webOrigin } from "../lib/host";
import { orpc } from "../lib/orpc";
import { useReduceMotion } from "../lib/reduce-motion";
import {
  activateWorkspace,
  confirmSignOut,
  createWorkspaceOffice,
} from "../lib/workspace-actions";
import { colors, radius } from "../theme";
import { Button } from "./Button";
import { Field } from "./Field";

const DRAWER_MAX = 320;

type Destination = {
  key: string;
  label: string;
  symbol: SFSymbol;
  current?: boolean;
  onPress: () => void;
};

export function OfficeSidebar({
  open,
  onClose,
  onOffice,
  onBoard,
  onKnowledge,
  onPlugins,
  onSettings,
}: {
  open: boolean;
  onClose: () => void;
  onOffice: () => void;
  onBoard: () => void;
  onKnowledge: () => void;
  onPlugins: () => void;
  onSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const meQuery = useQuery(orpc.me.queryOptions());
  const workspacesQuery = useQuery(orpc.workspaces.list.queryOptions());
  const [shown, setShown] = useState(open);
  const shownRef = useRef(open);
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const width = Math.min(
    Math.round(Dimensions.get("window").width * 0.82),
    DRAWER_MAX,
  );
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dx < -10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.15,
        onPanResponderMove: (_, gesture) => {
          dragX.setValue(Math.min(0, gesture.dx));
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldClose = gesture.dx < -width * 0.28 || gesture.vx < -0.85;
          if (shouldClose) {
            tapSelect();
            if (reduce) {
              dragX.setValue(0);
              closeRef.current();
              return;
            }
            Animated.timing(dragX, {
              toValue: -width,
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(() => {
              dragX.setValue(0);
              closeRef.current();
            });
            return;
          }
          Animated.spring(dragX, {
            toValue: 0,
            damping: 28,
            stiffness: 300,
            mass: 0.85,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dragX, reduce, width],
  );

  useEffect(() => {
    if (open) {
      shownRef.current = true;
      setShown(true);
      dragX.setValue(0);
      tapLight();
      if (reduce) {
        progress.setValue(1);
        return;
      }
      Animated.spring(progress, {
        toValue: 1,
        damping: 18,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      return;
    }
    setWorkspacesOpen(false);
    if (!shownRef.current) return;
    if (reduce) {
      progress.setValue(0);
      shownRef.current = false;
      setShown(false);
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      shownRef.current = false;
      dragX.setValue(0);
      setShown(false);
    });
  }, [dragX, open, progress, reduce]);

  function go(next: () => void) {
    tapSelect();
    onClose();
    if (reduce) {
      next();
      return;
    }
    setTimeout(next, 190);
  }

  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === meQuery.data?.workspaceId) {
      setWorkspacesOpen(false);
      return;
    }
    const listed = (workspacesQuery.data ?? []).find(
      (row) => row.id === workspaceId,
    );
    setBusy(true);
    setError("");
    try {
      await activateWorkspace({
        id: workspaceId,
        name: listed?.name,
        slug: listed?.slug,
      });
      tapSelect();
      setWorkspacesOpen(false);
      onClose();
    } catch (caught) {
      setError(userFacingError(caught, "Could not switch workspace"));
    } finally {
      setBusy(false);
    }
  }

  async function createWorkspace() {
    const name = newWorkspace.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      await createWorkspaceOffice(name);
      tapSelect();
      setNewWorkspace("");
      setWorkspacesOpen(false);
      onClose();
    } catch (caught) {
      setError(userFacingError(caught, "Could not create workspace"));
    } finally {
      setBusy(false);
    }
  }

  const workspaceName = meQuery.data?.workspaceName || "Office";
  const destinations: Destination[] = [
    {
      key: "office",
      label: "Office",
      symbol: "bubble.left.and.bubble.right",
      current: true,
      onPress: () => go(onOffice),
    },
    {
      key: "board",
      label: "Board",
      symbol: "checklist",
      onPress: () => go(onBoard),
    },
    {
      key: "knowledge",
      label: "Knowledge base",
      symbol: "book",
      onPress: () => go(onKnowledge),
    },
    {
      key: "plugins",
      label: "Plugins",
      symbol: "puzzlepiece",
      onPress: () => go(onPlugins),
    },
  ];

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.dim,
            {
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.28],
              }),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close sidebar"
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
        </Animated.View>
        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.drawer,
            {
              width,
              paddingTop: insets.top + 6,
              paddingBottom: Math.max(insets.bottom, 14),
              transform: [
                {
                  translateX: Animated.add(
                    progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-width, 0],
                    }),
                    dragX,
                  ),
                },
              ],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch workspace"
            onPress={() => {
              tapSelect();
              setWorkspacesOpen((value) => !value);
            }}
            style={({ pressed }) => [
              styles.workspace,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={[styles.mark, { backgroundColor: markColor(workspaceName) }]}>
              <Text style={styles.markLetter}>
                {workspaceInitial(workspaceName)}
              </Text>
            </View>
            <View style={styles.workspaceCopy}>
              <Text style={styles.workspaceName} numberOfLines={1}>
                {workspaceName}
              </Text>
              {meQuery.data?.email ? (
                <Text style={styles.workspaceMeta} numberOfLines={1}>
                  {meQuery.data.email}
                </Text>
              ) : null}
            </View>
            <SymbolView
              name={workspacesOpen ? "chevron.up" : "chevron.down"}
              tintColor={colors.muted}
              size={12}
              resizeMode="scaleAspectFit"
            />
          </Pressable>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {workspacesOpen ? (
              <View style={styles.group}>
                {(workspacesQuery.data ?? []).map((workspace, index, list) => {
                  const selected = workspace.id === meQuery.data?.workspaceId;
                  return (
                    <Pressable
                      key={workspace.id}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void switchWorkspace(workspace.id)}
                      style={({ pressed }) => [
                        styles.groupRow,
                        index < list.length - 1 ? styles.groupLine : null,
                        selected ? styles.current : null,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rowLabel,
                          selected ? styles.rowLabelCurrent : null,
                        ]}
                        numberOfLines={1}
                      >
                        {workspace.name}
                      </Text>
                      {selected ? (
                        <SymbolView
                          name="checkmark"
                          tintColor={colors.accent}
                          size={14}
                          resizeMode="scaleAspectFit"
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
                <View style={styles.create}>
                  <Field
                    placeholder="New workspace"
                    value={newWorkspace}
                    onChangeText={setNewWorkspace}
                    autoCapitalize="words"
                  />
                  <Button
                    label="Create"
                    onPress={() => void createWorkspace()}
                    busy={busy}
                    disabled={!newWorkspace.trim()}
                  />
                </View>
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.section}>Workspace</Text>
            <View style={styles.group}>
              {destinations.map((item, index) => (
                <SidebarRow
                  key={item.key}
                  label={item.label}
                  symbol={item.symbol}
                  current={item.current}
                  last={index === destinations.length - 1}
                  onPress={item.onPress}
                />
              ))}
            </View>

            <Text style={styles.section}>Account</Text>
            <View style={styles.group}>
              <SidebarRow
                label="Settings"
                symbol="gearshape"
                onPress={() => go(onSettings)}
              />
              <SidebarRow
                label="Open web office"
                symbol="safari"
                last
                onPress={() => {
                  tapSelect();
                  onClose();
                  void Linking.openURL(webOrigin());
                }}
              />
            </View>
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={confirmSignOut}
            style={({ pressed }) => [
              styles.signOut,
              pressed ? styles.pressed : null,
            ]}
          >
            <SymbolView
              name="rectangle.portrait.and.arrow.right"
              tintColor={colors.muted}
              size={16}
              resizeMode="scaleAspectFit"
            />
            <Text style={styles.signOutLabel}>Sign out</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SidebarRow({
  label,
  symbol,
  current,
  last,
  onPress,
}: {
  label: string;
  symbol: SFSymbol;
  current?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: current }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.groupRow,
        last ? null : styles.groupLine,
        current ? styles.current : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <SymbolView
        name={symbol}
        tintColor={current ? colors.text : colors.muted}
        size={18}
        resizeMode="scaleAspectFit"
      />
      <Text
        style={[styles.rowLabel, current ? styles.rowLabelCurrent : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function workspaceInitial(name: string): string {
  const letter = name.trim().charAt(0);
  return letter ? letter.toUpperCase() : "G";
}

const MARKS = ["#3d6b8a", "#6b4a7a", "#3f6b52", "#8a4e3d", "#4a5a8a", "#7a5a3d"];

function markColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return MARKS[Math.abs(hash) % MARKS.length] ?? "#3d6b8a";
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    maxWidth: DRAWER_MAX,
    backgroundColor: colors.bg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 10, height: 0 },
  },
  workspace: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  markLetter: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  workspaceCopy: { flex: 1, minWidth: 0, gap: 1 },
  workspaceName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  workspaceMeta: { color: colors.muted, fontSize: 13 },
  create: { padding: 12, gap: 10 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 10, paddingBottom: 16 },
  section: {
    color: colors.faint,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 8,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  groupRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  groupLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  current: { backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.surface2 },
  rowLabel: {
    color: colors.text,
    fontSize: 17,
    flex: 1,
  },
  rowLabelCurrent: { fontWeight: "600" },
  error: {
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  signOut: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  signOutLabel: { color: colors.muted, fontSize: 17 },
});
