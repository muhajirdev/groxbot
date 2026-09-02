import type {
  AttachmentAdapter,
  CompleteAttachment,
} from "@assistant-ui/react";
import {
  MAX_COMPUTER_ATTACHMENTS,
  MAX_COMPUTER_WRITE_BYTES,
} from "@groxbot/contracts";

export const COMPUTER_FILE_NOTE_PREFIX = "On this computer:";

export type ComputerWrite = (input: {
  filename: string;
  content: string;
  mediaType?: string;
}) => Promise<{ path: string; size: number }>;

export function computerFileNote(path: string): string {
  return `${COMPUTER_FILE_NOTE_PREFIX} ${path}`;
}

export function isComputerFileNote(text: string): boolean {
  return (
    text.startsWith(`${COMPUTER_FILE_NOTE_PREFIX} `) ||
    /^Saved on this computer as \S/u.test(text)
  );
}

export function createWorkspaceAttachmentAdapter(opts: {
  write: ComputerWrite;
  onPlaced?: (path: string) => void;
}): AttachmentAdapter {
  const pending = new Set<string>();
  return {
    accept: "*",
    async add({ file }) {
      if (pending.size >= MAX_COMPUTER_ATTACHMENTS) {
        throw new Error(
          `You can attach up to ${MAX_COMPUTER_ATTACHMENTS} files.`,
        );
      }
      if (file.size > MAX_COMPUTER_WRITE_BYTES) {
        throw new Error("That file is too large for this computer.");
      }
      const id = crypto.randomUUID();
      pending.add(id);
      return {
        id,
        type: file.type.startsWith("image/") ? "image" : "file",
        name: file.name,
        file,
        contentType: file.type,
        content: [],
        status: { type: "requires-action", reason: "composer-send" },
      };
    },
    async send(attachment) {
      const file = attachment.file;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const placed = await opts.write({
        filename: file.name || attachment.name,
        content: bytesToBase64(bytes),
        mediaType: file.type || attachment.contentType,
      });
      pending.delete(attachment.id);
      opts.onPlaced?.(placed.path);
      return {
        ...attachment,
        name: file.name || attachment.name,
        status: { type: "complete" },
        content: workspaceAttachmentContent({ path: placed.path }),
      };
    },
    async remove(attachment) {
      pending.delete(attachment.id);
    },
  };
}

export function workspaceAttachmentContent(input: {
  path: string;
}): CompleteAttachment["content"] {
  return [{ type: "text", text: computerFileNote(input.path) }];
}

export function bytesToBase64(bytes: Uint8Array): string {
  const buffer = (
    globalThis as {
      Buffer?: { from(bytes: Uint8Array): { toString(enc: string): string } };
    }
  ).Buffer;
  if (buffer) return buffer.from(bytes).toString("base64");
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
