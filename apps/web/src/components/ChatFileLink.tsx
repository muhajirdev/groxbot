import {
  createContext,
  type MouseEvent,
  type PropsWithChildren,
  type ReactNode,
  useContext,
} from "react";
import { parseChatHref } from "../lib/chat-link";

export type OpenComputerFile = (path: string) => void;
export type OpenKnowledgeFile = (path: string) => void;
export type DownloadChatFile = (path: string) => void | Promise<void>;

type FileOpenActions = {
  open: (path: string) => void;
  download?: DownloadChatFile;
};

const ComputerFileOpenContext = createContext<FileOpenActions | null>(null);
const KnowledgeFileOpenContext = createContext<FileOpenActions | null>(null);

export function ComputerFileOpenProvider(
  props: PropsWithChildren<{
    onOpen: OpenComputerFile;
    onDownload?: DownloadChatFile;
  }>,
) {
  return (
    <ComputerFileOpenContext.Provider
      value={{ open: props.onOpen, download: props.onDownload }}
    >
      {props.children}
    </ComputerFileOpenContext.Provider>
  );
}

export function KnowledgeFileOpenProvider(
  props: PropsWithChildren<{
    onOpen: OpenKnowledgeFile;
    onDownload?: DownloadChatFile;
  }>,
) {
  return (
    <KnowledgeFileOpenContext.Provider
      value={{ open: props.onOpen, download: props.onDownload }}
    >
      {props.children}
    </KnowledgeFileOpenContext.Provider>
  );
}

export function useOpenComputerFile() {
  return useContext(ComputerFileOpenContext)?.open ?? null;
}

export function useDownloadComputerFile() {
  return useContext(ComputerFileOpenContext)?.download ?? null;
}

export function useOpenKnowledgeFile() {
  return useContext(KnowledgeFileOpenContext)?.open ?? null;
}

export function useDownloadKnowledgeFile() {
  return useContext(KnowledgeFileOpenContext)?.download ?? null;
}

export function ChatFileLink(props: {
  href?: string;
  className?: string;
  children?: ReactNode;
}) {
  const open = useOpenComputerFile();
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
