export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Login: { invite?: string } | undefined;
  Onboarding: { invite?: string } | undefined;
  Roster: undefined;
  Thread: { botId: string };
  Computer: { botId: string };
  BotSettings: { botId: string };
  Hire: undefined;
  Knowledge: undefined;
  Plugins: { botId?: string } | undefined;
  You: undefined;
  Apps: { botId: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
