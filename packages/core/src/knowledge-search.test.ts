import { describe, expect, it } from "vitest";
import {
  dropKnowledgeSearchPrefix,
  emptyKnowledgeSearchSnapshot,
  encodeKnowledgeSearchSnapshot,
  knowledgeSearchDoc,
  parseKnowledgeSearchSnapshot,
  rankKnowledgeSearch,
  setKnowledgeSearchDoc,
  tokenizeKnowledgeQuery,
} from "./knowledge-search.js";

describe("tokenizeKnowledgeQuery", () => {
  it("drops short tokens and duplicates", () => {
    expect(tokenizeKnowledgeQuery("Weekly Update — a plan")).toEqual([
      "weekly",
      "update",
      "plan",
    ]);
  });

  it("keeps unicode letters", () => {
    expect(tokenizeKnowledgeQuery("café notes")).toEqual(["café", "notes"]);
  });

  it("also indexes an Indonesian clitic stem", () => {
    expect(tokenizeKnowledgeQuery("aplikasimu")).toEqual([
      "aplikasimu",
      "aplikasi",
    ]);
  });
});

describe("knowledgeSearchDoc", () => {
  it("prefers skill YAML, then a heading", () => {
    const skill = knowledgeSearchDoc(
      "skills/weekly-update/SKILL.md",
      "---\nname: weekly-update\ndescription: Five bullets.\n---\n# Monday\nKeep it tight.",
    );
    expect(skill).toMatchObject({
      title: "weekly-update",
      description: "Five bullets.",
    });
    expect(skill.text).toMatch(/Monday/);
    expect(
      knowledgeSearchDoc(
        "how-we-work/constraints.md",
        "# Constraints\nNo mail.",
      ).title,
    ).toBe("Constraints");
    expect(
      knowledgeSearchDoc("how-we-work/constraints.md", "No mail.").title,
    ).toBe("constraints.md");
  });

  it("reads a note title from frontmatter", () => {
    expect(
      knowledgeSearchDoc(
        "docs/hello-minikube.md",
        "---\ntitle: Halo Minikube\noneline: Tutorial minikube.\n---\nDeploy aplikasi.",
      ),
    ).toMatchObject({
      title: "Halo Minikube",
      description: "Tutorial minikube.",
    });
  });
});

describe("rankKnowledgeSearch", () => {
  it("ranks a title match above a body mention", () => {
    const hits = rankKnowledgeSearch(
      [
        knowledgeSearchDoc(
          "notes/aside.md",
          "We also send a weekly update if asked.",
        ),
        knowledgeSearchDoc(
          "skills/weekly-update/SKILL.md",
          "---\nname: weekly-update\ndescription: Five bullets for Monday.\n---\nKeep it tight.",
        ),
      ],
      "weekly update",
    );
    expect(hits[0]?.path).toBe("skills/weekly-update/SKILL.md");
    expect(hits[0]?.snippet).toMatch(/weekly/i);
  });

  it("ranks a unique body phrase over a title that shares one word", () => {
    const hits = rankKnowledgeSearch(
      [
        knowledgeSearchDoc("notes/meetings.md", "# Meetings\nStandup notes."),
        knowledgeSearchDoc(
          "notes/ops.md",
          "# Ops\nRun the vault parameter turned off after migrate.",
        ),
      ],
      "vault parameter turned",
    );
    expect(hits[0]?.path).toBe("notes/ops.md");
  });

  it("finds a phrase past the old 4k clip", () => {
    const tail = "obsidian vault equals notes daily command";
    const hits = rankKnowledgeSearch(
      [
        knowledgeSearchDoc("short.md", "# Short\nDaily notes live here."),
        knowledgeSearchDoc("long.md", `# Long\n${"alpha ".repeat(2500)}${tail}`),
      ],
      "vault equals notes daily",
    );
    expect(hits[0]?.path).toBe("long.md");
  });

  it("matches a possessive Indonesian title from the root", () => {
    const hits = rankKnowledgeSearch(
      [
        knowledgeSearchDoc(
          "docs/update.md",
          "---\ntitle: Memperbarui Aplikasimu\n---\nRolling update.",
        ),
        knowledgeSearchDoc(
          "docs/other.md",
          "---\ntitle: Menjelajahi Klaster\n---\nLihat pod.",
        ),
      ],
      "memperbarui aplikasi",
    );
    expect(hits[0]?.path).toBe("docs/update.md");
  });

  it("returns nothing for an empty query", () => {
    expect(
      rankKnowledgeSearch([knowledgeSearchDoc("voice.md", "quiet")], "   "),
    ).toEqual([]);
  });
});

describe("search snapshot edits", () => {
  it("patches one doc and drops a folder prefix", () => {
    let snap = emptyKnowledgeSearchSnapshot();
    snap = setKnowledgeSearchDoc(
      snap,
      knowledgeSearchDoc("skills/a/SKILL.md", "alpha"),
      200,
    );
    snap = setKnowledgeSearchDoc(
      snap,
      knowledgeSearchDoc("notes/b.md", "beta"),
      200,
    );
    expect(snap.docs.map((row) => row.path)).toEqual([
      "notes/b.md",
      "skills/a/SKILL.md",
    ]);
    snap = dropKnowledgeSearchPrefix(snap, "skills");
    expect(snap.docs.map((row) => row.path)).toEqual(["notes/b.md"]);
  });

  it("round-trips a snapshot as one index.json payload", () => {
    let snap = emptyKnowledgeSearchSnapshot();
    snap = setKnowledgeSearchDoc(
      snap,
      knowledgeSearchDoc("notes/n.md", "# Note\nbody"),
      800,
    );
    const parsed = parseKnowledgeSearchSnapshot(
      encodeKnowledgeSearchSnapshot(snap),
    );
    expect(parsed?.docs).toEqual(snap.docs);
    expect(parsed?.rev).toBe(snap.rev);
  });
});
