import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import { StyleSheet, View } from "react-native";
import { HeaderButton } from "../components/HeaderButton";
import { Mascot } from "../components/Mascot";
import { PopIn } from "../components/Motion";
import { OfficeThread } from "../components/OfficeThread";
import { Screen } from "../components/Screen";
import { ThreadTitle } from "../components/ThreadTitle";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Thread">;

export function ThreadScreen({ navigation, route }: Props) {
  const { botId } = route.params;
  const queryClient = useQueryClient();
  const meQuery = useQuery(orpc.me.queryOptions());
  const botQuery = useQuery(orpc.bots.get.queryOptions({ input: { botId } }));
  const bot = botQuery.data;

  useLayoutEffect(() => {
    const name = bot?.name ?? "Thread";
    navigation.setOptions({
      title: name,
      headerTitle: () => (
        <ThreadTitle
          name={name}
          color={bot?.avatarColor}
          shape={bot?.avatarShape}
          onPress={() => navigation.navigate("BotSettings", { botId })}
        />
      ),
      headerTitleAlign: "center",
      headerBackTitle: "",
      headerBackButtonDisplayMode: "minimal",
      headerRight: () => (
        <HeaderButton
          label="Computer"
          symbol="desktopcomputer"
          onPress={() => navigation.navigate("Computer", { botId })}
        />
      ),
    });
  }, [bot?.avatarColor, bot?.avatarShape, bot?.name, botId, navigation]);

  async function unarchive() {
    await client.bots.unarchive({ botId });
    await queryClient.invalidateQueries({ queryKey: orpc.bots.get.key() });
    await queryClient.invalidateQueries({ queryKey: orpc.bots.list.key() });
  }

  return (
    <Screen>
      {bot ? (
        <OfficeThread
          botId={bot.id}
          roomId={bot.homeRoomId || bot.id}
          botName={bot.name}
          avatarColor={bot.avatarColor}
          avatarShape={bot.avatarShape}
          archived={Boolean(bot.archivedAt)}
          needsModel={Boolean(meQuery.data?.needsModel)}
          userId={meQuery.data?.userId}
          userName={meQuery.data?.name}
          onNeedsModel={() =>
            navigation.navigate("You")
          }
          onOpenPath={(path) =>
            navigation.navigate("Computer", { botId: bot.id, path })
          }
          onUnarchive={() => void unarchive()}
        />
      ) : (
        <View style={styles.loading} accessibilityLabel="Opening thread">
          <PopIn>
            <Mascot size={56} mood="thinking" />
          </PopIn>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
