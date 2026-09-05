import type { AvatarShape } from "@groxbot/contracts";
import type { MascotMood } from "@groxbot/mascot";
import type { ReactNode } from "react";
import { AvatarMark } from "./Avatar";
import { SignOutIcon } from "./Icons";

const WELCOME_LEDE =
  "Named AI teammates you message like people. Each has a real computer. The whole team sits in one office.";
const WELCOME_NOTE =
  "Each Bot already has a computer. You can ignore it until you need the screen.";

export function GateShell(props: { children: ReactNode }) {
  return (
    <div className="screen">
      <div className="stack gate">{props.children}</div>
    </div>
  );
}

export function GateSplit(props: {
  children: ReactNode;
  proof: ReactNode;
  quote?: string;
  onSignOut?: () => void;
}) {
  return (
    <div className="screen gate-split-screen">
      {props.onSignOut ? (
        <button
          type="button"
          className="gate-signout"
          onClick={props.onSignOut}
        >
          <SignOutIcon />
          Sign out
        </button>
      ) : null}
      <div className="gate gate-split">
        <div className="gate-split-copy">{props.children}</div>
        <aside className="gate-split-proof" aria-hidden>
          {props.quote ? <p className="thesis">{props.quote}</p> : null}
          {props.proof}
        </aside>
      </div>
    </div>
  );
}

export function GateWelcome(props: {
  lede?: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="gate-stage gate-welcome">
      <p className="kicker">Welcome to Groxbot</p>
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
      <p className="lede">{props.lede ?? WELCOME_LEDE}</p>
      <p className="thesis">
        Give work the way you would a coworker. They pick it up and comment when
        done.
      </p>
      <p className="gate-note">{props.note ?? WELCOME_NOTE}</p>
      <div className="gate-welcome-actions">{props.children}</div>
    </div>
  );
}

export function GateMark(props: {
  size?: "md" | "lg";
  mood?: MascotMood;
  name?: string;
  color?: string;
  shape?: AvatarShape;
  hero?: boolean;
}) {
  return (
    <div className="gate-mark">
      <AvatarMark
        name={props.name ?? "Groxbot"}
        color={props.color ?? "#e45c9a"}
        shape={props.shape ?? "circle"}
        size={props.size ?? "md"}
        mood={props.mood ?? "happy"}
        hero={props.hero}
      />
    </div>
  );
}

export function GateBadge(props: { children: ReactNode }) {
  return <p className="hero-badge">{props.children}</p>;
}

export function GateSteps(props: { current: number; total: number }) {
  const labels = Array.from(
    { length: props.total },
    (_, step) => `Step ${step + 1}`,
  );
  return (
    <ol
      className="gate-steps"
      aria-label={`Step ${props.current + 1} of ${props.total}`}
    >
      {labels.map((label, step) => (
        <li
          key={label}
          className={
            step === props.current ? "on" : step < props.current ? "done" : ""
          }
        />
      ))}
    </ol>
  );
}

export function GateAnywhere(props: { hero?: boolean }) {
  return (
    <div className="gate-handoff" aria-hidden>
      <div className="device laptop">
        <div className="laptop-screen">Lid closed</div>
        <div className="laptop-base" />
        <span>Your laptop</span>
      </div>
      <div className="device cloud">
        <AvatarMark
          name="Groxbot"
          color="#e45c9a"
          shape="circle"
          size="sm"
          mood="working"
          hero={props.hero}
        />
        <span className="status-pill">
          <i /> Working
        </span>
        <span>Cloud computer</span>
      </div>
      <div className="device">
        <div className="phone-frame">
          <div className="phone-notch" />
          <div className="phone-screen">
            <div className="phone-head">
              <AvatarMark
                name="Chief"
                color="#e45c9a"
                shape="circle"
                size="xs"
                mood="working"
              />
              Chief
            </div>
            <p className="phone-typing">
              <i />
              <i />
              <i />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
