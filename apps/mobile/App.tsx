import {
  NavigationContainer,
  type LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Splash } from "./src/components/Splash";
import { authClient } from "./src/lib/auth";
import { inviteFromHref, rememberInvite } from "./src/lib/invite";
import { orpc, queryClient } from "./src/lib/orpc";
import { setPendingBotId } from "./src/lib/pending";
import { setRpcWorkspaceId } from "./src/lib/rpc-workspace";
import type { RootStackParamList } from "./src/navigation";
import { AppsScreen } from "./src/screens/Apps";
import { BillingScreen } from "./src/screens/Billing";
import { BoardScreen } from "./src/screens/Board";
import { BotSettingsScreen } from "./src/screens/BotSettings";
import { ComputerScreen } from "./src/screens/Computer";
import { CreateRoomScreen } from "./src/screens/CreateRoom";
import { HireScreen } from "./src/screens/Hire";
import { KnowledgeScreen } from "./src/screens/Knowledge";
import { LoginScreen } from "./src/screens/Login";
import { OnboardingScreen } from "./src/screens/Onboarding";
import { PluginsScreen } from "./src/screens/Plugins";
import { RoomScreen } from "./src/screens/Room";
import { RoomSettingsScreen } from "./src/screens/RoomSettings";
import { RosterScreen } from "./src/screens/Roster";
import { ThreadScreen } from "./src/screens/Thread";
import { WelcomeScreen } from "./src/screens/Welcome";
import { YouScreen } from "./src/screens/You";
import { colors, glassHeader, navTheme } from "./src/theme";
import { WorkingProvider } from "./src/working";

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL("/"), "groxbot://"],
  config: {
    screens: {
      Welcome: "",
      Login: "login",
      Onboarding: "onboarding",
      Office: "office",
      You: "you",
      Thread: "t/:botId",
      Room: "room/:roomId",
      Board: "board",
      Knowledge: "knowledge",
      Billing: "billing",
    },
  },
};

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
    if (meQuery.data?.workspaceId) {
      setRpcWorkspaceId(meQuery.data.workspaceId);
    }
  }, [meQuery.data?.workspaceId]);

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
        ...glassHeader,
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {!signedIn ? (
        <>
          <Stack.Screen name="Welcome" options={{ headerShown: false }}>
            {(props) => (
              <WelcomeScreen
                onStart={() => props.navigation.navigate("Login")}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="Login"
            options={{
              headerShown: false,
              presentation: "modal",
              animation: "slide_from_bottom",
              gestureEnabled: true,
            }}
          >
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
        <Stack.Screen
          name="Splash"
          component={Splash}
          options={{ headerShown: false }}
        />
      ) : meQuery.data?.needsWorkspace ? (
        <Stack.Screen name="Onboarding" options={{ headerShown: false }}>
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
          <Stack.Screen
            name="Office"
            component={RosterScreen}
            options={{ headerLargeTitleEnabled: true }}
          />
          <Stack.Screen
            name="You"
            component={YouScreen}
            options={{ title: "Settings" }}
          />
          <Stack.Screen name="Thread" component={ThreadScreen} />
          <Stack.Screen name="Room" component={RoomScreen} />
          <Stack.Screen
            name="RoomSettings"
            component={RoomSettingsScreen}
            options={{ title: "Members" }}
          />
          <Stack.Screen
            name="CreateRoom"
            component={CreateRoomScreen}
            options={{ title: "New room" }}
          />
          <Stack.Screen name="Computer" component={ComputerScreen} />
          <Stack.Screen
            name="BotSettings"
            component={BotSettingsScreen}
            options={{ title: "Settings" }}
          />
          <Stack.Screen
            name="Hire"
            component={HireScreen}
            options={{ title: "New Bot" }}
          />
          <Stack.Screen
            name="Board"
            component={BoardScreen}
            options={{ title: "Board" }}
          />
          <Stack.Screen
            name="Knowledge"
            component={KnowledgeScreen}
            options={{ title: "Knowledge base" }}
          />
          <Stack.Screen
            name="Plugins"
            component={PluginsScreen}
            options={{ title: "Plugins" }}
          />
          <Stack.Screen
            name="Billing"
            component={BillingScreen}
            options={{ title: "Usage & Billing" }}
          />
          <Stack.Screen
            name="Apps"
            component={AppsScreen}
            options={{ title: "Apps" }}
          />
          <Stack.Screen name="Onboarding" options={{ headerShown: false }}>
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
                        { name: "Office" },
                        { name: "Thread", params: { botId } },
                      ],
                    });
                  } else {
                    props.navigation.navigate("Office");
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
            <NavigationContainer
              theme={navTheme}
              linking={linking}
              fallback={<Splash />}
            >
              <RootNavigator />
              <StatusBar style="dark" />
            </NavigationContainer>
          </WorkingProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
});
