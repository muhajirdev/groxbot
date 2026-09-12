import {
  GROXBOT_MARK_COLOR,
  type MascotShape,
  mascotMarkSvg,
} from "@groxbot/mascot";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";

export function Mascot({
  size = 72,
  mood = "happy",
  color = GROXBOT_MARK_COLOR,
  shape = "circle",
  paintId = "groxbot-hero",
}: {
  size?: number;
  mood?: "idle" | "thinking" | "working" | "happy";
  color?: string;
  shape?: MascotShape;
  paintId?: string;
}) {
  const xml = mascotMarkSvg({
    color,
    shape,
    mood,
    paintId,
  });
  return (
    <View>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}
