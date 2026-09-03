import {
  type ComponentProps,
  createElement,
  type JSX,
  memo,
  type ReactNode,
  useMemo,
} from "react";
import { defaultRehypePlugins, Streamdown } from "streamdown";
import "streamdown/styles.css";
import { safeMarkdownUrl } from "../lib/chat-markdown";
import { rewriteKnowledgeHrefs } from "../lib/knowledge-link";

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

const OFFICE_REHYPE_PLUGINS = [
  rewriteKnowledgeHrefs,
  ...REHYPE_PLUGINS,
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
  variant?: "chat" | "document";
  officePaths?: boolean;
  urlTransform?: (url: string) => string | null;
  renderLink?: (props: { href: string; children: ReactNode }) => ReactNode;
}) {
  const text = props.text.trim();
  const transform = props.urlTransform ?? safeMarkdownUrl;
  const renderLink = props.renderLink;
  const isDocument = props.variant === "document";
  const components = useMemo(() => {
    if (!renderLink) return COMPONENTS;
    return {
      ...COMPONENTS,
      a: ({ href, children }: MdProps) =>
        href ? renderLink({ href, children }) : <span>{children}</span>,
    };
  }, [renderLink]);
  if (!text) return null;
  const live = Boolean(props.live);
  return (
    <Streamdown
      className={isDocument ? "knowledge-md" : "chat-md space-y-0"}
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
      rehypePlugins={props.officePaths ? OFFICE_REHYPE_PLUGINS : REHYPE_PLUGINS}
      urlTransform={transform}
      components={components}
    >
      {text}
    </Streamdown>
  );
});
