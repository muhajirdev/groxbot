import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { StyleSheet, Text, View } from "react-native";
import { AppCard } from "../components/AppCard";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { officeAppUrl, officeThreadUrl } from "../lib/host";
import { orpc } from "../lib/orpc";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Apps">;

export function AppsScreen({ navigation, route }: Props) {
  const { botId } = route.params;
  const appsQuery = useQuery(orpc.apps.list.queryOptions());
  const apps = appsQuery.data ?? [];

  return (
    <Screen scroll>
      <Header title="Apps" onBack={() => navigation.goBack()} />
      <Text style={styles.body}>
        Docs, slides, and sheets live in the office. Open one here to edit it in
        the web app.
      </Text>
      {apps.length === 0 ? (
        <Text style={styles.meta}>
          No live apps yet. Ask a teammate to stamp one.
        </Text>
      ) : null}
      <View style={styles.list}>
        {apps.map((app) => (
          <AppCard
            key={app.id}
            templateId={app.templateId}
            title={app.title}
            onOpen={() => {
              void Linking.openURL(officeAppUrl(botId, app.id));
            }}
          />
        ))}
      </View>
      <Button
        label="Open this thread on web"
        tone="ghost"
        onPress={() => {
          void Linking.openURL(officeThreadUrl(botId));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  meta: { color: colors.muted },
  list: { gap: 10 },
});
