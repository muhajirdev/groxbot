import { THINKING_EFFORT_OPTIONS } from "@groxbot/contracts";

export function EffortField(props: {
  value: string;
  onChange: (value: string) => void;
  inherit?: { label: string };
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <select
      aria-label={props["aria-label"] ?? "Effort"}
      className={props.className}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    >
      {props.inherit ? (
        <option value="">Workspace default ({props.inherit.label})</option>
      ) : null}
      {THINKING_EFFORT_OPTIONS.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
