import { makeAssistantToolUI } from "@assistant-ui/react";
import {
  defaultGenerativeUILibrary,
  renderGenerativeUI,
} from "@assistant-ui/react-generative-ui";
import {
  coercePresentInput,
  PRESENT_TOOL_NAME,
  safePresentImageSrc,
  sanitizePresentTree,
} from "@groxbot/contracts";
import { type ReactNode, useState } from "react";
import { z } from "zod";
import { computerFileKind } from "../lib/computer-preview";
import { ImageZoom } from "./assistant-ui/elements/image";
import {
  useDownloadComputerFile,
  useDownloadKnowledgeFile,
  useOpenComputerFile,
  useOpenKnowledgeFile,
} from "./ChatFileLink";
import { DownloadIcon, FileKindIcon } from "./Icons";

const image = defaultGenerativeUILibrary.Image;

function PresentFileMark(props: { path: string }) {
  return <FileKindIcon name={props.path} />;
}

function PresentFileChip(props: {
  path?: string;
  place?: string;
  title?: string;
}) {
  const path = typeof props.path === "string" ? props.path : "";
  const place = props.place === "knowledge" ? "knowledge" : "computer";
  const title =
    typeof props.title === "string" && props.title.trim()
      ? props.title.trim()
      : path.split("/").filter(Boolean).at(-1) || path;
  const openComputer = useOpenComputerFile();
  const openKnowledge = useOpenKnowledgeFile();
  const downloadComputer = useDownloadComputerFile();
  const downloadKnowledge = useDownloadKnowledgeFile();
  const open = place === "knowledge" ? openKnowledge : openComputer;
  const download = place === "knowledge" ? downloadKnowledge : downloadComputer;
  const [busy, setBusy] = useState(false);
  if (!path) return null;
  return (
    <div data-aui="file" data-aui-place={place}>
      <button
        type="button"
        data-aui="file-open"
        title={path}
        disabled={!open}
        onClick={() => open?.(path)}
      >
        <span
          data-aui="file-mark"
          data-kind={computerFileKind(path)}
          aria-hidden
        >
          <PresentFileMark path={path} />
        </span>
        <span data-aui="file-copy">
          <span data-aui="file-name">{title}</span>
          <span data-aui="file-place">
            {place === "knowledge" ? "Knowledge" : "Computer"}
          </span>
        </span>
      </button>
      {download ? (
        <button
          type="button"
          data-aui="file-download"
          aria-label={`Download ${title}`}
          title="Download"
          disabled={busy}
          aria-busy={busy}
          onClick={() => {
            if (busy) return;
            setBusy(true);
            void Promise.resolve(download(path)).finally(() => setBusy(false));
          }}
        >
          <DownloadIcon />
        </button>
      ) : null}
    </div>
  );
}

const officeLibrary = {
  ...defaultGenerativeUILibrary,
  File: {
    description:
      "A file on this computer or in the office knowledge library. Click opens it; the download control saves a copy.",
    properties: z.object({
      path: z.string().describe("Office-root path, no .."),
      place: z
        .enum(["computer", "knowledge"])
        .optional()
        .describe(
          "computer is this bot's desk; knowledge is the office library.",
        ),
      title: z
        .string()
        .optional()
        .describe("Optional label; defaults to the filename."),
    }),
    render: (props: { path?: string; place?: string; title?: string }) => (
      <PresentFileChip
        path={props.path}
        place={props.place}
        title={props.title}
      />
    ),
  },
  ...(image
    ? {
        Image: {
          ...image,
          render: (props: Parameters<typeof image.render>[0]) => {
            const src =
              typeof props.src === "string"
                ? safePresentImageSrc(props.src)
                : null;
            if (!src) return null;
            const alt = typeof props.alt === "string" ? props.alt : "Image";
            return (
              <ImageZoom src={src} alt={alt}>
                {image.render({ ...props, src })}
              </ImageZoom>
            );
          },
        },
      }
    : {}),
};

export function PresentSurface(props: {
  tree: unknown;
  streaming?: boolean;
}): ReactNode {
  const coerced = coercePresentInput(props.tree);
  const tree = props.streaming ? coerced : sanitizePresentTree(coerced);
  if (!tree || typeof tree !== "object") return null;
  return (
    <div data-aui="root" data-slot="office-present">
      {renderGenerativeUI(tree, officeLibrary, {
        status: props.streaming ? "streaming" : "done",
      })}
    </div>
  );
}

export const PresentToolUI = makeAssistantToolUI({
  toolName: PRESENT_TOOL_NAME,
  display: "standalone",
  render: ({ args, status }) => (
    <PresentSurface tree={args} streaming={status?.type !== "complete"} />
  ),
});
