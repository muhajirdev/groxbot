import type { ReactNode } from "react";
import { GateSplit, GateWelcome } from "../components/Gate";
import { OfficeFeed } from "../components/OfficeFeed";

export function Welcome(props: { start: ReactNode }) {
  return (
    <GateSplit proof={<OfficeFeed />}>
      <GateWelcome>{props.start}</GateWelcome>
    </GateSplit>
  );
}
