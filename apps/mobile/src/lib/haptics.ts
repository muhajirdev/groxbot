import * as Haptics from "expo-haptics";

export function tapSoft(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
}

export function tapLight(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function tapMedium(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function tapSelect(): void {
  void Haptics.selectionAsync();
}

export function tapSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function tapError(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
