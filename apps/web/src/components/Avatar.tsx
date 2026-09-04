import type { AvatarShape } from "@groxbot/contracts";
import { MascotMark, type MascotMood } from "@groxbot/mascot";

export function MemberStack(props: {
  faces: readonly {
    botId: string;
    name: string;
    avatarColor: string;
    avatarShape: AvatarShape;
  }[];
}) {
  const faces = props.faces.slice(0, 3);
  if (faces.length <= 1) {
    const face = faces[0];
    if (!face) return <span className="inline-grid size-7 shrink-0" />;
    return (
      <AvatarMark
        name={face.name}
        color={face.avatarColor}
        shape={face.avatarShape}
        size="sm"
      />
    );
  }
  return (
    <span className="member-stack" data-n={faces.length}>
      {faces.map((face) => (
        <span key={face.botId} className="member-stack-face">
          <AvatarMark
            name={face.name}
            color={face.avatarColor}
            shape={face.avatarShape}
            size="xs"
          />
        </span>
      ))}
    </span>
  );
}

export function AvatarMark(props: {
  name: string;
  color: string;
  shape: AvatarShape;
  large?: boolean;
  mood?: MascotMood;
  size?: "xs" | "sm" | "md" | "lg";
  hero?: boolean;
}) {
  return (
    <MascotMark
      name={props.name}
      color={props.color}
      shape={props.shape}
      mood={props.mood}
      size={props.size ?? (props.large ? "lg" : "md")}
      className={props.hero ? "mascot-hero" : undefined}
    />
  );
}

export function ShapePicks(props: {
  color: string;
  value: AvatarShape;
  shapes: AvatarShape[];
  onChange: (shape: AvatarShape) => void;
}) {
  return (
    <div className="shape-picks">
      {props.shapes.map((shape) => (
        <button
          key={shape}
          type="button"
          className={`shape-pick${props.value === shape ? " on" : ""}`}
          aria-label={shape}
          aria-pressed={props.value === shape}
          onClick={() => props.onChange(shape)}
        >
          <AvatarMark
            name={shape}
            color={props.color}
            shape={shape}
            size="sm"
          />
        </button>
      ))}
    </div>
  );
}
