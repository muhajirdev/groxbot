import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../components/Avatar";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { OfficeThread } from "../components/OfficeThread";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";
import { useWorking } from "../working";

type Props = NativeStackScreenProps<RootStackParamList, "Thread">;

export function ThreadScreen({ navigation, route }: Props) {
  const { botId } = route.params;
  const queryClient = useQueryClient();
  const meQuery = useQuery(orpc.me.queryOptions());
  const botQuery = useQuery(orpc.bots.get.queryOptions({ input: { botId } }));
  const bot = botQuery.data;
  const working = useWorking(botId);

  async function unarchive() {
    await client.bots.unarchive({ botId });
    await queryClient.invalidateQueries({ queryKey: orpc.bots.get.key() });
    await queryClient.invalidateQueries({ queryKey: orpc.bots.list.key() });
  }

  return (
    <Screen>
      <Header
        title={bot?.name ?? "Thread"}
        onBack={() => navigation.navigate("Roster")}
        right={
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate("Computer", { botId })}
            >
              <Text style={styles.link}>Computer</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate("Apps", { botId })}
            >
              <Text style={styles.link}>Apps</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate("BotSettings", { botId })}
            >
              <Text style={styles.link}>Settings</Text>
            </Pressable>
          </View>
        }
      />
      {bot ? (
        <View style={styles.ident}>
          <Avatar
            name={bot.name}
            color={bot.avatarColor}
            shape={bot.avatarShape}
            size={28}
            working={working}
          />
          <Text style={styles.job} numberOfLines={1}>
            {bot.title || "Teammate"}
          </Text>
        </View>
      ) : null}
      {bot ? (
        <OfficeThread
          botId={bot.id}
          botName={bot.name}
          archived={Boolean(bot.archivedAt)}
          needsModel={Boolean(meQuery.data?.needsModel)}
          userId={meQuery.data?.userId}
          userName={meQuery.data?.name}
          onNeedsModel={() => navigation.navigate("You")}
          onUnarchive={() => void unarchive()}
        />
      ) : (
        <Text style={styles.loading}>Opening thread…</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  link: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  ident: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  job: { color: colors.muted, fontSize: 13, flex: 1 },
  loading: { color: colors.muted, padding: 16 },
});
