import { describe, expect, it } from "vitest";
import {
  FILE_BODY_MAX_CHARS,
  FILE_IDLE_PREFETCH_MAX,
  FILE_PREFETCH_ALL_MAX,
  isCacheableTextPreview,
  isPersistableFileBody,
  knowledgeIdlePrefetchPaths,
} from "./file-cache";

describe("isCacheableTextPreview", () => {
  it("warms markdown and other text, not images or archives", () => {
    expect(isCacheableTextPreview("people/contact.md")).toBe(true);
    expect(isCacheableTextPreview("notes.json")).toBe(true);
    expect(isCacheableTextPreview("shot.png")).toBe(false);
    expect(isCacheableTextPreview("deck.pdf")).toBe(false);
    expect(isCacheableTextPreview("bundle.zip")).toBe(false);
  });
});

describe("isPersistableFileBody", () => {
  it("keeps small text reads and skips binary or huge bodies", () => {
    expect(
      isPersistableFileBody({
        path: "people/contact.md",
        content: "# Contact",
        encoding: "text",
      }),
    ).toBe(true);
    expect(
      isPersistableFileBody({
        path: "shot.png",
        content: "",
        encoding: "binary",
      }),
    ).toBe(false);
    expect(
      isPersistableFileBody({
        path: "big.md",
        content: "a".repeat(FILE_BODY_MAX_CHARS + 1),
        encoding: "text",
      }),
    ).toBe(false);
    expect(isPersistableFileBody(undefined)).toBe(false);
    expect(FILE_PREFETCH_ALL_MAX).toBe(4);
  });
});

describe("knowledgeIdlePrefetchPaths", () => {
  const contact = {
    path: "people/contact.md",
    name: "contact.md",
    encoding: "text" as const,
    mediaType: "text/markdown",
  };
  const skill = {
    path: "skills/weekly/SKILL.md",
    name: "SKILL.md",
    encoding: "text" as const,
  };
  const shot = {
    path: "shots/hero.png",
    name: "hero.png",
    encoding: "binary" as const,
    mediaType: "image/png",
  };
  const notes = {
    path: "notes.json",
    name: "notes.json",
    encoding: "text" as const,
    mediaType: "application/json",
  };

  it("warms markdown first and skips binaries and cache hits", () => {
    expect(
      knowledgeIdlePrefetchPaths([shot, notes, skill, contact], {
        prefer: "people/contact.md",
        hasCached: (path) => path === "notes.json",
      }),
    ).toEqual(["people/contact.md", "skills/weekly/SKILL.md"]);
  });

  it("caps a flood so boot does not fetch the whole library", () => {
    const entries = Array.from({ length: FILE_IDLE_PREFETCH_MAX + 8 }, (_, i) => ({
      path: `notes/n${i}.md`,
      name: `n${i}.md`,
      encoding: "text" as const,
    }));
    expect(knowledgeIdlePrefetchPaths(entries)).toHaveLength(
      FILE_IDLE_PREFETCH_MAX,
    );
  });
});
