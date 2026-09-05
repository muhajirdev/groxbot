import { describe, expect, it } from "vitest";
import {
  assertShareableKnowledgePath,
  KnowledgeShareError,
  knowledgeShareCoversPath,
} from "./knowledge-shares.js";
import { KnowledgePathError } from "./knowledge.js";

describe("assertShareableKnowledgePath", () => {
  it("rejects the office root", () => {
    expect(() => assertShareableKnowledgePath("")).toThrow(KnowledgeShareError);
    expect(() => assertShareableKnowledgePath("/")).toThrow(KnowledgeShareError);
  });

  it("rejects hidden indexes", () => {
    expect(() => assertShareableKnowledgePath("_search/index.json")).toThrow(
      KnowledgeShareError,
    );
    expect(() => assertShareableKnowledgePath("_links/index.json")).toThrow(
      KnowledgeShareError,
    );
  });

  it("rejects parent segments", () => {
    expect(() =>
      assertShareableKnowledgePath("playbooks/../../secret"),
    ).toThrow(KnowledgePathError);
  });

  it("keeps an office-root path", () => {
    expect(assertShareableKnowledgePath("how-we-work/voice.md")).toBe(
      "how-we-work/voice.md",
    );
  });
});

describe("knowledgeShareCoversPath", () => {
  it("is exact for a file share", () => {
    expect(
      knowledgeShareCoversPath("how-we-work/voice.md", "file", "how-we-work/voice.md"),
    ).toBe(true);
    expect(
      knowledgeShareCoversPath("how-we-work/voice.md", "file", "how-we-work/other.md"),
    ).toBe(false);
  });

  it("is a prefix for a folder share", () => {
    expect(
      knowledgeShareCoversPath("playbooks", "folder", "playbooks"),
    ).toBe(true);
    expect(
      knowledgeShareCoversPath(
        "playbooks",
        "folder",
        "playbooks/weekly-update/SKILL.md",
      ),
    ).toBe(true);
    expect(
      knowledgeShareCoversPath("playbooks", "folder", "how-we-work/voice.md"),
    ).toBe(false);
    expect(
      knowledgeShareCoversPath("play", "folder", "playbooks/x.md"),
    ).toBe(false);
  });
});
