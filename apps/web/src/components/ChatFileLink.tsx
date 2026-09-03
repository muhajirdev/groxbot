import {
  createContext,
  useContext,
  type MouseEvent,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { parseChatHref } from "../lib/chat-link";

export type OpenComputerFile = (path: string) => void;

const ComputerFileOpenContext = createContext<OpenComputerFile | null>(null);

export function ComputerFileOpenProvider(
  props: PropsWithChildren<{ onOpen: OpenComputerFile }>,
) {
  return (
    <ComputerFileOpenContext.Provider value={props.onOpen}>
      {props.children}
    </ComputerFileOpenContext.Provider>
  );
}

export function ChatFileLink(props: {
  href?: string;
  className?: string;
  children?: ReactNode;
}) {
  const open = useContext(ComputerFileOpenContext);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const parsed = parseChatHref(props.href ?? "", origin);
  if (parsed.kind === "external") {
    return (
      <a
        href={parsed.href}
        className={props.className}
        target="_blank"
        rel="noreferrer noopener"
      >
        {props.children}
      </a>
    );
  }
  if (parsed.kind !== "path" || !open) {
    return <span className={props.className}>{props.children}</span>;
  }
  return (
    <a
      href={`#${parsed.path}`}
      className={props.className}
      title={parsed.path}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        open(parsed.path);
      }}
    >
      {props.children}
    </a>
  );
}
