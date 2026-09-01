import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg(props: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={props.className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <title>Icon</title>
      {props.children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M9 7v4M15 7v4M8 11h8v3a4 4 0 0 1-8 0v-3Z" />
      <path d="M12 18v3" />
    </Svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
    </Svg>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function CollapseIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M9 6l6 6-6 6M4 4v16" />
    </Svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M14 3H8a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V9z" />
      <path d="M14 3v6h6" />
    </Svg>
  );
}

export function ImageFileIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
      <circle cx="8.5" cy="9" r="1.2" />
    </Svg>
  );
}

export function MarkdownFileIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M4 6h16v12H4z" />
      <path d="M7 15V9l2.5 3L12 9v6M15 12.5l1.5 2.5 1.5-2.5V9" />
    </Svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <circle cx="6" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="18" cy="12" r="1.2" fill="currentColor" />
    </Svg>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </Svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.2v2.2M12 18.6V20.8M3.2 12h2.2M18.6 12h2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" />
    </Svg>
  );
}

export function DoubleChevronIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M8 6l5 6-5 6M13 6l5 6-5 6" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg className={props.className}>
      <path d="M5 12l5 5L19 7" />
    </Svg>
  );
}

export function GoogleIcon(props: IconProps) {
  return (
    <svg
      className={props.className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <title>Google</title>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.48a5.54 5.54 0 01-2.4 3.64v3.02h3.88c2.27-2.09 3.53-5.17 3.53-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0012 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.26a7.2 7.2 0 010-4.52V6.63H1.27a12 12 0 000 10.74l4-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.36.61 4.61 1.8l3.46-3.46C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.63l4 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

export function GitHubIcon(props: IconProps) {
  return (
    <svg
      className={props.className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <title>GitHub</title>
      <path d="M12 .3a12 12 0 00-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.36-1.33-1.72-1.33-1.72-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58A12 12 0 0012 .3z" />
    </svg>
  );
}
