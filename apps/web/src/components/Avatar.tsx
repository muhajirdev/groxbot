import type { AvatarShape } from "@groxbot/contracts";
import { MascotMark, type MascotMood } from "@groxbot/mascot";
import { useState } from "react";
import { clayAvatarSrc } from "../lib/clay-avatar";
import { cn } from "../ui";

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
    if (!face) return <span className="inline-grid size-11 shrink-0" />;
    return (
      <AvatarMark
        name={face.name}
        color={face.avatarColor}
        shape={face.avatarShape}
        size="md"
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

/** Bottom-right presence pip. Ring matches the surface behind the avatar. */
export function PresenceDot(props: { on: boolean; selected?: boolean }) {
  if (!props.on) return null;
  return (
    <span
      className={cn(
        "pointer-events-none absolute right-0 bottom-0 size-2 rounded-full bg-ok ring-2",
        props.selected ? "ring-selected" : "ring-bg-side",
      )}
      aria-hidden
    />
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
  /** Opt-in clay photo. Office faces are the mascot mark. */
  photo?: boolean;
}) {
  const size = props.size ?? (props.large ? "lg" : "md");
  const usePhoto = props.photo === true;
  const [broken, setBroken] = useState(false);
  const src = clayAvatarSrc(props.name);

  if (usePhoto && !broken) {
    return (
      <span
        className={cn(
          "clay-avatar",
          `clay-avatar-${size}`,
          props.mood === "working" && "is-working",
          props.hero && "mascot-hero",
        )}
        aria-hidden
      >
        <img src={src} alt="" onError={() => setBroken(true)} />
      </span>
    );
  }

  return (
    <MascotMark
      name={props.name}
      color={props.color}
      shape={props.shape}
      mood={props.mood}
      size={size}
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
