import { describe, expect, it } from "vitest";
import {
  dropKnowledgeEntry,
  knowledgeUploadPath,
  optimisticKnowledgeEntry,
  seedKnowledgePreview,
  upsertKnowledgeEntry,
} from "./knowledge-upload";

describe("knowledgeUploadPath", () => {
  it("nests under the selected folder and strips path junk", () => {
    expect(knowledgeUploadPath("playbooks", "shot.png")).toBe(
      "playbooks/shot.png",
    );
    expect(knowledgeUploadPath("", "../../secret.pdf")).toBe("secret.pdf");
  });
});

describe("optimisticKnowledgeEntry", () => {
  it("marks images binary and markdown as text", () => {
    expect(
      optimisticKnowledgeEntry("brief.pdf", {
        name: "brief.pdf",
        size: 12,
        type: "application/pdf",
      }),
    ).toMatchObject({
      path: "brief.pdf",
      encoding: "binary",
      mediaType: "application/pdf",
    });
    expect(
      optimisticKnowledgeEntry("how-we-work/voice.md", {
        name: "voice.md",
        size: 40,
        type: "text/markdown",
      }),
    ).toMatchObject({
      path: "how-we-work/voice.md",
      encoding: "text",
      title: "voice.md",
    });
  });
});

describe("upsertKnowledgeEntry", () => {
  it("inserts and replaces by path", () => {
    const first = upsertKnowledgeEntry(undefined, {
      path: "a.md",
      name: "a.md",
      title: "a",
      description: "",
      encoding: "text",
      mediaType: "text/markdown",
    });
    const next = upsertKnowledgeEntry(first, {
      path: "b.pdf",
      name: "b.pdf",
      title: "b",
      description: "",
      encoding: "binary",
      mediaType: "application/pdf",
    });
    expect(next.entries.map((row) => row.path)).toEqual(["a.md", "b.pdf"]);
    expect(
      dropKnowledgeEntry(next, "a.md").entries.map((row) => row.path),
    ).toEqual(["b.pdf"]);
  });
});

describe("seedKnowledgePreview", () => {
  it("reads markdown and downloads pdf from the local bytes", () => {
    const note = seedKnowledgePreview(
      "how-we-work/voice.md",
      { name: "voice.md", type: "text/markdown" },
      new TextEncoder().encode("# Voice"),
    );
    expect(note.read).toMatchObject({
      path: "how-we-work/voice.md",
      encoding: "text",
      content: "# Voice",
    });
    const brief = seedKnowledgePreview(
      "brief.pdf",
      { name: "brief.pdf", type: "application/pdf" },
      new Uint8Array([1, 2, 3, 4]),
    );
    expect(brief.download).toMatchObject({
      path: "brief.pdf",
      filename: "brief.pdf",
      mediaType: "application/pdf",
    });
    expect(brief.read).toBeUndefined();
  });
});
