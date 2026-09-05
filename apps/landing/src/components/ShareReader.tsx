import { MascotMark } from "@groxbot/mascot";
import { Link } from "@tanstack/react-router";
import type { PublicKnowledge, PublicKnowledgeEntry } from "@groxbot/contracts";
import type { ReactNode } from "react";
import { publicKnowledgeUrl } from "../lib/public-knowledge";
import { renderShareMarkdown } from "../lib/share-markdown";

const INLINE_IMAGES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function ShareChrome(props: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="share-page">
      <header className="share-nav">
        <Link className="share-brand" to="/" aria-label="Groxbot home">
          <MascotMark name="Groxbot" color="#e45c9a" shape="circle" size="sm" />
          Groxbot
        </Link>
        <span className="share-kicker">Shared note</span>
      </header>
      <main className="share-body">
        {props.title ? <h1 className="share-title">{props.title}</h1> : null}
        {props.children}
      </main>
      <footer className="share-foot">
        Shared from{" "}
        <Link to="/" className="share-foot-link">
          Groxbot
        </Link>
        . Unlisted link.
      </footer>
    </div>
  );
}

export function ShareMissing() {
  return (
    <ShareChrome title="This link is no longer public.">
      <p className="share-lede">It may have been unpublished.</p>
    </ShareChrome>
  );
}

export function ShareDocument(props: {
  shareId: string;
  childPath?: string;
  data: PublicKnowledge;
}) {
  const { data, shareId } = props;
  if (data.kind === "folder") {
    return (
      <ShareChrome title={data.title}>
        <ShareCrumbs shareId={shareId} path={data.path} current />
        <ShareFolder shareId={shareId} entries={data.entries} />
      </ShareChrome>
    );
  }
  return (
    <ShareChrome title={data.title}>
      {props.childPath ? (
        <ShareCrumbs shareId={shareId} path={data.path} current />
      ) : null}
      {data.description ? (
        <p className="share-lede">{data.description}</p>
      ) : null}
      {data.truncated ? (
        <p className="share-lede">This note is truncated in the reader.</p>
      ) : null}
      <ShareFile shareId={shareId} file={data} />
    </ShareChrome>
  );
}

function ShareCrumbs(props: {
  shareId: string;
  path: string;
  current?: boolean;
}) {
  const parts = props.path.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <nav className="share-crumbs" aria-label="Folder">
      <Link to="/s/$shareId" params={{ shareId: props.shareId }}>
        Share
      </Link>
      {parts.map((name, index) => {
        const prefix = parts.slice(0, index + 1).join("/");
        const last = index === parts.length - 1;
        return (
          <span key={prefix}>
            <span className="share-crumb-sep">/</span>
            {last && props.current ? (
              <span>{name}</span>
            ) : (
              <Link
                to="/s/$shareId"
                params={{ shareId: props.shareId }}
                search={{ p: prefix }}
              >
                {name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function ShareFolder(props: {
  shareId: string;
  entries: PublicKnowledgeEntry[];
}) {
  if (props.entries.length === 0) {
    return <p className="share-lede">This folder is empty.</p>;
  }
  return (
    <ul className="share-list">
      {props.entries.map((entry) => (
        <li key={entry.path}>
          <Link
            to="/s/$shareId"
            params={{ shareId: props.shareId }}
            search={{ p: entry.path }}
          >
            {entry.title || entry.name}
          </Link>
          {entry.kind === "dir" ? (
            <span className="share-muted">Folder</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ShareFile(props: {
  shareId: string;
  file: Extract<PublicKnowledge, { kind: "file" }>;
}) {
  const { file, shareId } = props;
  const raw = publicKnowledgeUrl(shareId, file.path, "raw");
  const media = file.mediaType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (INLINE_IMAGES.has(media)) {
    return (
      <p>
        <img className="share-image" src={raw} alt={file.title} />
      </p>
    );
  }
  if (media === "text/html" || media === "image/svg+xml") {
    return (
      <p>
        <a className="btn" href={raw}>
          Download {file.path.split("/").at(-1)}
        </a>
      </p>
    );
  }
  if (file.encoding === "text" && file.content != null) {
    const markdown =
      media === "text/markdown" || file.path.toLowerCase().endsWith(".md");
    if (markdown) {
      return (
        <article
          className="share-prose"
          dangerouslySetInnerHTML={{
            __html: renderShareMarkdown(file.content, {
              shareId,
              currentPath: file.path,
              granted: file.root,
              kind: file.root === file.path ? "file" : "folder",
              rawUrl: (path) => publicKnowledgeUrl(shareId, path, "raw"),
            }),
          }}
        />
      );
    }
    return (
      <pre className="share-pre">
        <code>{file.content}</code>
      </pre>
    );
  }
  return (
    <p>
      <a className="btn" href={raw}>
        Download {file.path.split("/").at(-1)}
      </a>
    </p>
  );
}
