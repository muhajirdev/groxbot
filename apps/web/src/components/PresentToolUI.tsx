import { makeAssistantToolUI } from "@assistant-ui/react";
import {
  defaultGenerativeUILibrary,
  renderGenerativeUI,
} from "@assistant-ui/react-generative-ui";
import {
  PRESENT_TOOL_NAME,
  safePresentImageSrc,
  sanitizePresentTree,
} from "@groxbot/contracts";
import type { ReactNode } from "react";

const image = defaultGenerativeUILibrary.Image;

const officeLibrary = {
  ...defaultGenerativeUILibrary,
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
            return image.render({ ...props, src });
          },
        },
      }
    : {}),
};

export function PresentSurface(props: {
  tree: unknown;
  streaming?: boolean;
}): ReactNode {
  const tree = props.streaming ? props.tree : sanitizePresentTree(props.tree);
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
