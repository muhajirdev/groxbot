import { GROXBOT_DEMO_URL } from "../lib/onboarding";

export function ScheduleDemoButton(props: { className?: string }) {
  return (
    <a
      className={props.className}
      href={GROXBOT_DEMO_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      Schedule a demo
    </a>
  );
}
