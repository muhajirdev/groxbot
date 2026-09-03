import type { ComputerDownload, KnowledgeFile } from "@groxbot/contracts";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import {
  computerDownloadBlob,
  computerDownloadFilename,
} from "../lib/computer-download";
import {
  computerFileKind,
  computerPreviewKind,
  computerPreviewSource,
} from "../lib/computer-preview";
import { userFacingError } from "../lib/errors";
import {
  knowledgeLinkTarget,
  knowledgeMarkdownUrl,
  parseKnowledgeHref,
} from "../lib/knowledge-link";
import {
  knowledgeMarkdownHasHeading,
  splitKnowledgeMarkdown,
} from "../lib/knowledge-markdown";
import { orpc } from "../lib/orpc";
import { THINK_MESSAGES_GC_TIME } from "../lib/think-messages";
import { ChatMarkdown } from "./ChatMarkdown";

export function KnowledgeFilePreview(props: {
  path: string;
  mediaType?: string;
  localFile?: File | null;
  files?: ReadonlySet<string>;
  onOpen?: (path: string) => void;
}) {
  const kind = computerPreviewKind(props.path, props.mediaType);
  const source = computerPreviewSource(kind);
  const filename = computerDownloadFilename(props.path);
  const links =
    props.files && props.onOpen
      ? { files: props.files, onOpen: props.onOpen }
      : undefined;
  if (props.localFile) {
    return (
      <LocalFilePreview
        file={props.localFile}
        path={props.path}
        filename={filename}
        kind={kind}
        links={links}
      />
    );
  }
  return (
    <RemoteFilePreview
      path={props.path}
      filename={filename}
      kind={kind}
      source={source}
      links={links}
    />
  );
}

function RemoteFilePreview(props: {
  path: string;
  filename: string;
  kind: ReturnType<typeof computerPreviewKind>;
  source: ReturnType<typeof computerPreviewSource>;
  links?: OfficeLinks;
}) {
  const textQuery = useQuery({
    ...orpc.knowledge.read.queryOptions({
      input: { path: props.path },
    }),
    enabled: props.source === "read",
    staleTime: 60_000,
    gcTime: THINK_MESSAGES_GC_TIME,
  });
  const fileQuery = useQuery({
    ...orpc.knowledge.download.queryOptions({
      input: { path: props.path },
    }),
    enabled: props.source === "download",
    staleTime: 60_000,
    gcTime: THINK_MESSAGES_GC_TIME,
  });
  const loading =
    props.source !== "none" &&
    ((props.source === "read" && textQuery.isPending) ||
      (props.source === "download" && fileQuery.isPending));
  const error = textQuery.error ?? fileQuery.error;
  const text = textQuery.data;
  const file = fileQuery.data;
  const readyText = text && text.encoding !== "binary" ? text : null;

  if (loading) return <p className="computer-preview-status">Opening…</p>;
  if (error) {
    return (
      <p className="computer-preview-status">
        {userFacingError(error, "Could not open that file")}
      </p>
    );
  }
  if (props.kind === "text" && readyText) {
    return (
      <TextPreview file={readyText} path={props.path} links={props.links} />
    );
  }
  if (props.kind === "html" && readyText) {
    return (
      <iframe
        className="computer-preview-frame"
        title={props.filename}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={readyText.content}
      />
    );
  }
  if (props.kind === "image" && file) {
    return <BlobPreview file={file} kind="image" filename={props.filename} />;
  }
  if (props.kind === "pdf" && file) {
    return <BlobPreview file={file} kind="pdf" filename={props.filename} />;
  }
  return (
    <p className="computer-preview-status">
      This file can’t be previewed. Download it instead.
    </p>
  );
}

function LocalFilePreview(props: {
  file: File;
  path: string;
  filename: string;
  kind: ReturnType<typeof computerPreviewKind>;
  links?: OfficeLinks;
}) {
  const [text, setText] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (props.kind === "text" || props.kind === "html") {
      let gone = false;
      void props.file.text().then((value) => {
        if (!gone) setText(value);
      });
      return () => {
        gone = true;
      };
    }
    if (props.kind === "image" || props.kind === "pdf") {
      const next = URL.createObjectURL(props.file);
      setUrl(next);
      return () => {
        URL.revokeObjectURL(next);
      };
    }
  }, [props.file, props.kind]);

  if (props.kind === "text") {
    if (text == null)
      return <p className="computer-preview-status">Opening…</p>;
    return (
      <TextPreview
        path={props.path}
        file={{
          path: props.path,
          title: props.filename,
          description: "",
          content: text,
          truncated: false,
          encoding: "text",
          mediaType: props.file.type || "text/plain",
          backlinks: [],
        }}
        links={props.links}
      />
    );
  }
  if (props.kind === "html") {
    if (text == null)
      return <p className="computer-preview-status">Opening…</p>;
    return (
      <iframe
        className="computer-preview-frame"
        title={props.filename}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={text}
      />
    );
  }
  if (!url && (props.kind === "image" || props.kind === "pdf")) {
    return <p className="computer-preview-status">Opening…</p>;
  }
  if (props.kind === "image" && url) {
    return (
      <div className="computer-preview-image-wrap">
        <img src={url} alt={props.filename} />
      </div>
    );
  }
  if (props.kind === "pdf" && url) {
    return (
      <iframe
        className="computer-preview-frame"
        title={props.filename}
        src={url}
      />
    );
  }
  return (
    <p className="computer-preview-status">
      This file can’t be previewed. Download it instead.
    </p>
  );
}

function TextPreview(props: {
  file: KnowledgeFile;
  path: string;
  links?: OfficeLinks;
}) {
  const markdown =
    computerFileKind(props.path) === "md" ||
    props.file.mediaType === "text/markdown";
  return (
    <div
      className={markdown ? "knowledge-preview-md" : "computer-preview-text"}
    >
      {props.file.truncated ? (
        <p className="computer-preview-note">
          Showing the first part of this file.
        </p>
      ) : null}
      {markdown ? (
        <KnowledgeMarkdown text={props.file.content} links={props.links} />
      ) : (
        <pre>{props.file.content}</pre>
      )}
    </div>
  );
}

export function KnowledgeMarkdown(props: {
  text: string;
  links?: OfficeLinks;
}) {
  const split = splitKnowledgeMarkdown(props.text);
  const body = split.body;
  const showTitle = Boolean(
    split.meta.title && !knowledgeMarkdownHasHeading(body),
  );
  const links = props.links;
  return (
    <article className="knowledge-doc">
      {showTitle ? (
        <h1 className="knowledge-doc-title">{split.meta.title}</h1>
      ) : null}
      <KnowledgeDocMeta
        updated={split.meta.updated}
        source={split.meta.source}
      />
      {links ? (
        <ChatMarkdown
          text={body}
          variant="document"
          officePaths
          urlTransform={knowledgeMarkdownUrl}
          renderLink={({ href, children }) => (
            <OfficeMarkdownLink
              href={href}
              files={links.files}
              onOpen={links.onOpen}
            >
              {children}
            </OfficeMarkdownLink>
          )}
        />
      ) : (
        <ChatMarkdown text={body} variant="document" />
      )}
    </article>
  );
}

function KnowledgeDocMeta(props: { updated: string; source: string }) {
  if (!props.updated && !props.source) return null;
  return (
    <p className="knowledge-doc-meta">
      {props.updated ? <span>Updated {props.updated}</span> : null}
      {props.updated && props.source ? <span aria-hidden> · </span> : null}
      {props.source ? (
        /^https?:\/\//iu.test(props.source) ? (
          <a href={props.source} target="_blank" rel="noreferrer noopener">
            Source
          </a>
        ) : (
          <span>{props.source}</span>
        )
      ) : null}
    </p>
  );
}

type OfficeLinks = {
  files: ReadonlySet<string>;
  onOpen: (path: string) => void;
};

function OfficeMarkdownLink(props: {
  href: string;
  files: ReadonlySet<string>;
  onOpen: (path: string) => void;
  children: ReactNode;
}) {
  const parsed = parseKnowledgeHref(props.href);
  if (parsed.kind === "external") {
    return (
      <a href={parsed.href} target="_blank" rel="noreferrer noopener">
        {props.children}
      </a>
    );
  }
  if (parsed.kind !== "path") return <span>{props.children}</span>;
  const target = knowledgeLinkTarget(parsed.path, props.files);
  if (!target) {
    return (
      <span
        className="knowledge-link missing"
        title={`${parsed.path} is not in this office`}
      >
        {props.children}
      </span>
    );
  }
  return (
    <a
      href={`#${parsed.path}`}
      className="knowledge-link"
      title={parsed.path}
      onClick={(event) => {
        event.preventDefault();
        props.onOpen(parsed.path);
      }}
    >
      {props.children}
    </a>
  );
}

function BlobPreview(props: {
  file: ComputerDownload;
  kind: "image" | "pdf";
  filename: string;
}) {
  const url = useBlobUrl(props.file);
  if (!url) return <p className="computer-preview-status">Opening…</p>;
  if (props.kind === "image") {
    return (
      <div className="computer-preview-image-wrap">
        <img src={url} alt={props.filename} />
      </div>
    );
  }
  return (
    <iframe
      className="computer-preview-frame"
      title={props.filename}
      src={url}
    />
  );
}

function useBlobUrl(file: ComputerDownload): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(computerDownloadBlob(file));
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
    };
  }, [file]);
  return url;
}
