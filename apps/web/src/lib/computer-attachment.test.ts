import type { PendingAttachment } from "@assistant-ui/react";
import { MAX_COMPUTER_ATTACHMENTS } from "@groxbot/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  bytesToBase64,
  createWorkspaceAttachmentAdapter,
  workspaceAttachmentContent,
} from "./computer-attachment";

describe("workspaceAttachmentContent", () => {
  it("keeps a small image inline and names the inbox path", () => {
    const bytes = new TextEncoder().encode("png");
    const content = workspaceAttachmentContent({
      path: "inbox/shot.png",
      mediaType: "image/png",
      bytes,
    });
    expect(content[0]).toMatchObject({
      type: "text",
      text: "Saved on this computer as inbox/shot.png.",
    });
    expect(content[1]).toMatchObject({
      type: "file",
      filename: "inbox/shot.png",
      mimeType: "image/png",
    });
  });

  it("does not inline a document", () => {
    const content = workspaceAttachmentContent({
      path: "inbox/brief.md",
      mediaType: "text/markdown",
      bytes: new TextEncoder().encode("# hi"),
    });
    expect(content).toEqual([
      { type: "text", text: "Saved on this computer as inbox/brief.md." },
    ]);
  });
});

describe("createWorkspaceAttachmentAdapter", () => {
  it("writes on send and caps at six files", async () => {
    const write = vi.fn(async (input: { filename: string }) => ({
      path: `inbox/${input.filename}`,
      size: 4,
    }));
    const adapter = createWorkspaceAttachmentAdapter({ write });
    const file = new File(["note"], "brief.md", { type: "text/markdown" });
    const pending = (await adapter.add({ file })) as PendingAttachment;
    const sent = await adapter.send(pending);
    expect(write).toHaveBeenCalledWith({
      filename: "brief.md",
      content: bytesToBase64(new TextEncoder().encode("note")),
      mediaType: "text/markdown",
    });
    expect(sent.name).toBe("inbox/brief.md");

    for (let i = 0; i < MAX_COMPUTER_ATTACHMENTS; i++) {
      await adapter.add({
        file: new File(["x"], `n${i}.txt`, { type: "text/plain" }),
      });
    }
    await expect(
      adapter.add({
        file: new File(["x"], "overflow.txt", { type: "text/plain" }),
      }),
    ).rejects.toThrow(/up to 6/);
  });
});
