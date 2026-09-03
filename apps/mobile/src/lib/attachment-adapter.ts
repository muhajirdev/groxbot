import type {
  AttachmentAdapter,
  CompleteAttachment,
} from "@assistant-ui/react-native";
import {
  MAX_COMPUTER_ATTACHMENTS,
  MAX_COMPUTER_WRITE_BYTES,
} from "@groxbot/contracts";
import {
  bytesToBase64,
  type ComputerWrite,
  computerFileNote,
} from "./computer-attachment";

export type { ComputerWrite };

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
        content: [{ type: "text", text: computerFileNote(placed.path) }],
      } satisfies CompleteAttachment;
    },
    async remove(attachment) {
      pending.delete(attachment.id);
    },
  };
}
