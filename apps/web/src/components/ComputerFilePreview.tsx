import type { ComputerDownload } from "@groxbot/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  computerDownloadBlob,
  computerDownloadFilename,
} from "../lib/computer-download";
import {
  computerPreviewKind,
  computerPreviewSource,
} from "../lib/computer-preview";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { ModalShell } from "../ui";
import { CloseIcon, DownloadIcon } from "./Icons";

export function ComputerFilePreview(props: {
  botId: string;
  path: string | null;
  downloading: boolean;
  onClose: () => void;
  onDownload: (path: string) => void;
}) {
  const path = props.path;
  const filename = path ? computerDownloadFilename(path) : "file";
  const kind = computerPreviewKind(path ?? "");
  const source = computerPreviewSource(kind);
  const textQuery = useQuery({
    ...orpc.computer.read.queryOptions({
      input: { botId: props.botId, path: path ?? "" },
    }),
    enabled: Boolean(path) && source === "read",
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const fileQuery = useQuery({
    ...orpc.computer.download.queryOptions({
      input: { botId: props.botId, path: path ?? "" },
    }),
    enabled: Boolean(path) && source === "download",
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const loading =
    source !== "none" &&
    ((source === "read" && textQuery.isPending) ||
      (source === "download" && fileQuery.isPending));
  const error = textQuery.error ?? fileQuery.error;
  const text = textQuery.data;
  const file = fileQuery.data;
  const readyText = text && text.encoding !== "binary" ? text : null;

  return (
    <ModalShell
      open={Boolean(path)}
      wide
      onClose={props.onClose}
      className="computer-preview-modal"
    >
      <div className="computer-preview-head">
        <h2>{filename}</h2>
        <div className="row tight">
          {path ? (
            <button
              className="icon-btn"
              type="button"
              aria-label={`Download ${filename}`}
              title="Download"
              disabled={props.downloading}
              onClick={() => props.onDownload(path)}
            >
              <DownloadIcon />
            </button>
          ) : null}
          <button
            className="icon-btn"
            type="button"
            aria-label="Close preview"
            title="Close"
            onClick={props.onClose}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="computer-preview-body">
        {!path ? null : loading ? (
          <p className="computer-preview-status">Opening…</p>
        ) : error ? (
          <p className="computer-preview-status">
            {userFacingError(error, "Could not open that file")}
          </p>
        ) : kind === "text" && readyText ? (
          <div className="computer-preview-text">
            {readyText.truncated ? (
              <p className="computer-preview-note">
                Showing the first part of this file.
              </p>
            ) : null}
            <pre>{readyText.content}</pre>
          </div>
        ) : kind === "html" && readyText ? (
          <iframe
            className="computer-preview-frame"
            title={filename}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={readyText.content}
          />
        ) : kind === "image" && file ? (
          <ComputerBlobPreview file={file} kind="image" filename={filename} />
        ) : kind === "pdf" && file ? (
          <ComputerBlobPreview file={file} kind="pdf" filename={filename} />
        ) : (
          <p className="computer-preview-status">
            This file can’t be previewed. Download it instead.
          </p>
        )}
      </div>
    </ModalShell>
  );
}

function ComputerBlobPreview(props: {
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
