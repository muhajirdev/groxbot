import { ActionSheetIOS, Alert, Platform } from "react-native";

export type ActionSheetItem = {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  cancel?: boolean;
};

export function showActionSheet(
  title: string | undefined,
  items: ActionSheetItem[],
) {
  const options = items.map((item) => item.label);
  const cancelButtonIndex = items.findIndex((item) => item.cancel);
  const destructiveButtonIndex = items.findIndex((item) => item.destructive);

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options,
        cancelButtonIndex:
          cancelButtonIndex >= 0 ? cancelButtonIndex : undefined,
        destructiveButtonIndex:
          destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
        userInterfaceStyle: "light",
      },
      (index) => {
        items[index]?.onPress?.();
      },
    );
    return;
  }

  Alert.alert(
    title ?? "",
    undefined,
    items.map((item) => ({
      text: item.label,
      style: item.cancel
        ? "cancel"
        : item.destructive
          ? "destructive"
          : "default",
      onPress: item.onPress,
    })),
  );
}
