import { GROXBOT_MARK_COLOR, mascotMarkSvg } from "@groxbot/mascot";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";

export function Mascot({
  size = 72,
  mood = "happy",
}: {
  size?: number;
  mood?: "idle" | "thinking" | "working" | "happy";
}) {
  const xml = mascotMarkSvg({
    color: GROXBOT_MARK_COLOR,
    shape: "circle",
    mood,
    paintId: "groxbot-hero",
  });
  return (
    <View>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}
