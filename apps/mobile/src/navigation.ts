export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Login: { invite?: string } | undefined;
  Onboarding: { invite?: string } | undefined;
  Office: undefined;
  You: undefined;
  Thread: { botId: string };
  Room: { roomId: string };
  RoomSettings: { roomId: string };
  CreateRoom: undefined;
  Computer: { botId: string; path?: string };
  BotSettings: { botId: string };
  Hire: undefined;
  Board: undefined;
  Knowledge: { path?: string } | undefined;
  Plugins: { botId?: string } | undefined;
  Billing: undefined;
  Apps: { botId: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
