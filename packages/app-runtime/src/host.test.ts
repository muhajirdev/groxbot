import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function transformServer(src: string): string {
  return src.replace(/^import\s+.*$/m, "").replace(/^export\s+/gm, "").trim();
}

async function bootGadget(
  kind: "docs" | "slides" | "sheets" | "crm" | "game",
  initial: unknown,
) {
  const vendor = kind === "crm" || kind === "game" ? "groxbot" : "cloudflare-os";
  const preamble = fs.readFileSync(
    path.join(root, "scripts", "host-preamble.js"),
    "utf8",
  );
  const boot = fs.readFileSync(path.join(root, "scripts", "host-boot.js"), "utf8");
  const server = transformServer(
    fs.readFileSync(
      path.join(root, "vendor", vendor, kind, "server.js"),
      "utf8",
    ),
  );
  const persist = {
    state: initial as unknown,
    load: async () => persist.state,
    save: async (state: unknown) => {
      persist.state = state;
    },
  };
  const window = { gadget: persist };
  const run = new Function(
    "window",
    `return (async function () {\n${preamble}\n${server}\n${boot}\nreturn gadget;\n})();`,
  );
  const gadget = await run(window);
  return { gadget, persist };
}

describe("iframe gadget host", () => {
  it("docs subscribe migrates html and applyOperation persists", async () => {
    const { gadget, persist } = await bootGadget("docs", {
      title: "Q3",
      html: "<p>hi</p>",
    });
    const callbacks = {
      dup() {
        return this;
      },
      onRpcBroken() {},
      operation() {},
      presence() {},
    };
    const doc = await gadget.subscribe(callbacks, { clientId: "c1" });
    expect(doc.title).toBe("Q3");
    expect(doc.legacyContent).toContain("hi");
    const next = await gadget.initializeBlocks({
      blocks: [{ id: "b1", html: "<p data-block-id=\"b1\">hi</p>" }],
      title: "Q3",
      senderId: "c1",
    });
    expect(next.blocks[0].html).toContain("hi");
    await gadget.applyOperation({
      senderId: "c1",
      upserts: [
        {
          id: "b1",
          html: "<p data-block-id=\"b1\">hello</p>",
          baseVersion: 1,
        },
      ],
      deletes: [],
      order: ["b1"],
      title: "Q3",
    });
    await new Promise((r) => setTimeout(r, 80));
    const saved = persist.state as { kv?: { "document:v2"?: { blocks: Array<{ html: string }> } } };
    expect(saved.kv?.["document:v2"]?.blocks[0]?.html).toContain("hello");
  });

  it("slides getDeck hydrates a titled cover", async () => {
    const { gadget } = await bootGadget("slides", {
      themeVersion: "workspace.1",
      slides: [
        {
          id: "s1",
          title: "Q3",
          background: { color: "#F6821F" },
          blocks: [
            {
              id: "b_title",
              type: "title",
              x: 33,
              y: 197,
              props: { text: "Q3" },
            },
          ],
        },
      ],
    });
    const deck = await gadget.getDeck();
    expect(deck.slides[0].title).toBe("Q3");
    const id = await gadget.addSlide(1, null);
    expect(id).toBeTruthy();
    const next = await gadget.getDeck();
    expect(next.slides.length).toBe(2);
  });

  it("crm subscribe hydrates contacts and upserts", async () => {
    const { gadget } = await bootGadget("crm", {
      title: "Acme",
      contacts: [],
    });
    const callbacks = {
      dup() {
        return this;
      },
      onRpcBroken() {},
      operation() {},
    };
    const doc = await gadget.subscribe(callbacks);
    expect(doc.title).toBe("Acme");
    const next = await gadget.upsertContact({
      name: "Ada",
      company: "Acme",
      stage: "talking",
    });
    expect(next.contacts).toHaveLength(1);
    expect(next.contacts[0].name).toBe("Ada");
    expect(next.contacts[0].stage).toBe("talking");
    const moved = await gadget.moveContact(next.contacts[0].id, "won");
    expect(moved.contacts[0].stage).toBe("won");
  });

  it("game move and reset share one board", async () => {
    const { gadget } = await bootGadget("game", {
      title: "Duel",
      board: [null, null, null, null, null, null, null, null, null],
      turn: "X",
    });
    const start = await gadget.getGame();
    expect(start.title).toBe("Duel");
    const afterX = await gadget.move(0, "X");
    expect(afterX.board[0]).toBe("X");
    expect(afterX.turn).toBe("O");
    const ignored = await gadget.move(1, "X");
    expect(ignored.board[1]).toBeNull();
    await gadget.move(1, "O");
    const reset = await gadget.reset();
    expect(reset.board.every((cell: string | null) => cell == null)).toBe(true);
    expect(reset.turn).toBe("X");
    expect(reset.title).toBe("Duel");
  });
});
