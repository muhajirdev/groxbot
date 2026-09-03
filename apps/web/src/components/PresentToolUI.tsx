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
import type { ReactNode } from "react";
import { z } from "zod";
import { ImageZoom } from "./assistant-ui/elements/image";
import { useOpenComputerFile, useOpenKnowledgeFile } from "./ChatFileLink";

const image = defaultGenerativeUILibrary.Image;

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
  const open = place === "knowledge" ? openKnowledge : openComputer;
  if (!path) return null;
  return (
    <button
      type="button"
      data-aui="file"
      data-aui-place={place}
      title={path}
      disabled={!open}
      onClick={() => open?.(path)}
    >
      <span data-aui="file-name">{title}</span>
      <span data-aui="file-place">
        {place === "knowledge" ? "Knowledge" : "Computer"}
      </span>
    </button>
  );
}

const officeLibrary = {
  ...defaultGenerativeUILibrary,
  File: {
    description:
      "A file on this computer or in the office knowledge library. Click opens it.",
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
