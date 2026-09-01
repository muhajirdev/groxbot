import {
  createElement,
  memo,
  type ComponentProps,
  type JSX,
  type ReactNode,
} from "react";
import { Streamdown, defaultRehypePlugins } from "streamdown";
import "streamdown/styles.css";
import { safeMarkdownUrl } from "../lib/chat-markdown";

const SANITIZE = defaultRehypePlugins.sanitize;
const HARDEN = Array.isArray(defaultRehypePlugins.harden)
  ? defaultRehypePlugins.harden[0]
  : defaultRehypePlugins.harden;
if (!SANITIZE || !HARDEN) {
  throw new Error("streamdown plugins missing");
}

const REHYPE_PLUGINS = [
  SANITIZE,
  [
    HARDEN,
    {
      allowDataImages: false,
      allowedLinkPrefixes: ["*"],
      allowedProtocols: ["https:", "http:", "mailto:"],
      imageBlockPolicy: "remove",
      linkBlockPolicy: "remove",
    },
  ],
] as NonNullable<ComponentProps<typeof Streamdown>["rehypePlugins"]>;

type MdProps = {
  children?: ReactNode;
  href?: string;
};

function md<T extends keyof JSX.IntrinsicElements>(tag: T) {
  return function Md(props: MdProps) {
    return createElement(tag, null, props.children);
  };
}

const COMPONENTS = {
  p: md("p"),
  ul: md("ul"),
  ol: md("ol"),
  li: md("li"),
  blockquote: md("blockquote"),
  h1: md("h1"),
  h2: md("h2"),
  h3: md("h3"),
  h4: md("h4"),
  h5: md("h5"),
  h6: md("h6"),
  hr: md("hr"),
  table: md("table"),
  thead: md("thead"),
  tbody: md("tbody"),
  tr: md("tr"),
  th: md("th"),
  td: md("td"),
  pre: md("pre"),
  code: md("code"),
  strong: md("strong"),
  em: md("em"),
  img: () => null,
  a: ({ href, children }: MdProps) =>
    href ? (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
};

export const ChatMarkdown = memo(function ChatMarkdown(props: {
  text: string;
  live?: boolean;
}) {
  const text = props.text.trim();
  if (!text) return null;
  const live = Boolean(props.live);
  return (
    <Streamdown
      className="chat-md space-y-0"
      skipHtml
      unwrapDisallowed
      disallowedElements={["img"]}
      mode={live ? "streaming" : "static"}
      isAnimating={live}
      caret={live ? "block" : undefined}
      parseIncompleteMarkdown
      controls={false}
      lineNumbers={false}
      codeBlockMaxHeight={0}
      tableMaxHeight={0}
      animated={false}
      linkSafety={{ enabled: false }}
      rehypePlugins={REHYPE_PLUGINS}
      urlTransform={safeMarkdownUrl}
      components={COMPONENTS}
    >
      {text}
    </Streamdown>
  );
});
