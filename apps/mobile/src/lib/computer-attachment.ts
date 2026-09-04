import {
  MAX_COMPUTER_ATTACHMENTS,
  MAX_COMPUTER_WRITE_BYTES,
} from "@groxbot/contracts";
import { isComputerFileNote } from "./office-messages";

export { isComputerFileNote };

export const COMPUTER_FILE_NOTE_PREFIX = "On this computer:";

export function computerFileNote(path: string): string {
  return `${COMPUTER_FILE_NOTE_PREFIX} ${path}`;
}

export type PickedOfficeFile = {
  name: string;
  mediaType: string;
  size: number;
  base64: string;
};

export type ComputerWrite = (input: {
  filename: string;
  content: string;
  mediaType?: string;
}) => Promise<{ path: string; size: number }>;

export function assertAttachable(file: {
  name: string;
  size: number;
  pending: number;
}): void {
  if (file.pending >= MAX_COMPUTER_ATTACHMENTS) {
    throw new Error(`You can attach up to ${MAX_COMPUTER_ATTACHMENTS} files.`);
  }
  if (file.size > MAX_COMPUTER_WRITE_BYTES) {
    throw new Error("That file is too large for this computer.");
  }
  if (!file.name.trim()) throw new Error("Name the file to attach.");
}

export function workspaceAttachmentText(path: string): string {
  return computerFileNote(path);
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

export function base64ToBytes(b64: string): Uint8Array {
  const buffer = (
    globalThis as {
      Buffer?: { from(text: string, enc: string): Uint8Array };
    }
  ).Buffer;
  if (buffer) return Uint8Array.from(buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** File-shaped object for assistant-ui’s AttachmentAdapter on React Native. */
export class OfficeBlobFile {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly previewUri?: string;
  private readonly bytes: Uint8Array;

  constructor(input: {
    name: string;
    type: string;
    bytes: Uint8Array;
    previewUri?: string;
  }) {
    this.name = input.name;
    this.type = input.type;
    this.size = input.bytes.byteLength;
    this.previewUri = input.previewUri;
    this.bytes = input.bytes;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const copy = new ArrayBuffer(this.bytes.byteLength);
    new Uint8Array(copy).set(this.bytes);
    return copy;
  }
}
