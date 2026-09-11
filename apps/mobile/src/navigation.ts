export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Login: { invite?: string } | undefined;
  Onboarding: { invite?: string } | undefined;
  Roster: undefined;
  Thread: { botId: string };
  Room: { roomId: string };
  RoomSettings: { roomId: string };
  CreateRoom: undefined;
  Board: undefined;
  Computer: { botId: string; path?: string };
  BotSettings: { botId: string };
  Hire: undefined;
  Knowledge: { path?: string } | undefined;
  Plugins: { botId?: string } | undefined;
  You: undefined;
  Billing: undefined;
  Apps: { botId: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
