import type { ReactNode } from "react";
import { AvatarMark } from "../components/Avatar";
import { GateBadge, GateShell } from "../components/Gate";

export function Welcome(props: { start: ReactNode }) {
  return (
    <GateShell>
      <div className="gate-hero">
        <GateBadge>Open source · Multiplayer</GateBadge>
        <h1 className="hero-title">
          <span>Meet</span>
          <AvatarMark
            name="Groxbot"
            color="#e45c9a"
            shape="circle"
            size="md"
            mood="happy"
            hero
          />
          <span>Groxbot</span>
        </h1>
        <div className="gate-stage">
          <p className="lede">Like Grok Bot, for the whole team.</p>
          <p className="thesis">
            Create a Bot, message it, grant access as needed. There isn’t
            anything to learn.
          </p>
          <div className="row gate-actions">{props.start}</div>
        </div>
      </div>
    </GateShell>
  );
}
