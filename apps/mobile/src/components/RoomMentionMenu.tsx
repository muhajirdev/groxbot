import { useAui, useAuiState } from "@assistant-ui/react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  applyRoomMention,
  matchRoomMentions,
  mentionDraftAt,
  type RoomMentionSeat,
} from "../lib/room-mention";
import { colors } from "../theme";

const MAX_HITS = 8;

export function RoomMentionMenu(props: {
  seats: readonly RoomMentionSeat[];
}) {
  const aui = useAui();
  const value = useAuiState((s) => s.composer.text);
  const live = props.seats.filter((row) => !row.archivedAt);
  const draft = live.length === 0 ? null : mentionDraftAt(value, value.length);
  const hits = draft
    ? matchRoomMentions(draft.needle, live).slice(0, MAX_HITS)
    : [];
  if (!draft || hits.length === 0) return null;

  return (
    <View style={styles.list} accessibilityRole="list">
      {hits.map((seat) => (
        <Pressable
          key={seat.id}
          accessibilityRole="button"
          onPress={() => {
            const next = applyRoomMention(value, draft, seat.name);
            aui.composer.setText(next.text);
          }}
          style={styles.item}
        >
          <Text style={styles.name}>@{seat.name}</Text>
          {seat.title ? (
            <Text style={styles.desc} numberOfLines={1}>
              {seat.title}
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
