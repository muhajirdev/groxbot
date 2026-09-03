import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { authClient } from "./src/lib/auth";
import { inviteFromHref, rememberInvite } from "./src/lib/invite";
import { orpc, queryClient } from "./src/lib/orpc";
import { setPendingBotId } from "./src/lib/pending";
import type { RootStackParamList } from "./src/navigation";
import { AppsScreen } from "./src/screens/Apps";
import { BotSettingsScreen } from "./src/screens/BotSettings";
import { ComputerScreen } from "./src/screens/Computer";
import { HireScreen } from "./src/screens/Hire";
import { KnowledgeScreen } from "./src/screens/Knowledge";
import { LoginScreen } from "./src/screens/Login";
import { OnboardingScreen } from "./src/screens/Onboarding";
import { PluginsScreen } from "./src/screens/Plugins";
import { RosterScreen } from "./src/screens/Roster";
import { ThreadScreen } from "./src/screens/Thread";
import { WelcomeScreen } from "./src/screens/Welcome";
import { YouScreen } from "./src/screens/You";
import { colors } from "./src/theme";
import { WorkingProvider } from "./src/working";

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: [Linking.createURL("/"), "groxbot://"],
  config: {
    screens: {
      Welcome: "",
      Login: "login",
      Onboarding: "onboarding",
      Roster: "office",
      Thread: "t/:botId",
    },
  },
};

function Splash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function RootNavigator() {
  const client = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const result = await authClient.getSession();
      return result.data ?? null;
    },
  });
  const signedIn = Boolean(sessionQuery.data);
  const meQuery = useQuery({
    ...orpc.me.queryOptions(),
    enabled: signedIn,
  });

  useEffect(() => {
    function remember(url: string) {
      const invite = inviteFromHref(url);
      if (invite) rememberInvite(invite);
      void client.invalidateQueries({ queryKey: ["session"] });
    }
    void Linking.getInitialURL().then((url) => {
      if (url) remember(url);
    });
    const sub = Linking.addEventListener("url", (event) => remember(event.url));
    return () => sub.remove();
  }, [client]);

  if (sessionQuery.isLoading) return <Splash />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {!signedIn ? (
        <>
          <Stack.Screen name="Welcome">
            {(props) => (
              <WelcomeScreen
                onStart={() => props.navigation.navigate("Login")}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Login">
            {(props) => (
              <LoginScreen
                invite={props.route.params?.invite}
                onAuthed={() => {
                  void client.invalidateQueries({ queryKey: ["session"] });
                }}
              />
            )}
          </Stack.Screen>
        </>
      ) : meQuery.isLoading ? (
        <Stack.Screen name="Splash" component={Splash} />
      ) : meQuery.data?.needsWorkspace ? (
        <Stack.Screen name="Onboarding">
          {(props) => (
            <OnboardingScreen
              invite={props.route.params?.invite}
              onDone={(botId) => {
                void client.invalidateQueries({ queryKey: orpc.me.key() });
                void client.invalidateQueries({ queryKey: ["session"] });
                if (botId) setPendingBotId(botId);
              }}
            />
          )}
        </Stack.Screen>
      ) : (
        <>
          <Stack.Screen name="Roster" component={RosterScreen} />
          <Stack.Screen name="Thread" component={ThreadScreen} />
          <Stack.Screen name="Computer" component={ComputerScreen} />
          <Stack.Screen name="BotSettings" component={BotSettingsScreen} />
          <Stack.Screen name="Hire" component={HireScreen} />
          <Stack.Screen name="Knowledge" component={KnowledgeScreen} />
          <Stack.Screen name="Plugins" component={PluginsScreen} />
          <Stack.Screen name="You" component={YouScreen} />
          <Stack.Screen name="Apps" component={AppsScreen} />
          <Stack.Screen name="Onboarding">
            {(props) => (
              <OnboardingScreen
                invite={props.route.params?.invite}
                onDone={(botId) => {
                  void client.invalidateQueries({ queryKey: orpc.me.key() });
                  if (botId) {
                    setPendingBotId(botId);
                    props.navigation.reset({
                      index: 1,
                      routes: [
                        { name: "Roster" },
                        { name: "Thread", params: { botId } },
                      ],
                    });
                  } else {
                    props.navigation.navigate("Roster");
                  }
                }}
              />
            )}
          </Stack.Screen>
        </>
      )}
    </Stack.Navigator>
  );
}

export function App() {
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <WorkingProvider>
            <NavigationContainer linking={linking} fallback={<Splash />}>
              <RootNavigator />
              <StatusBar style="light" />
            </NavigationContainer>
          </WorkingProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
