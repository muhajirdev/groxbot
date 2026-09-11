import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createMigratedDb } from "./node.js";
import { bots, messages, organization, threads, user } from "./schema/index.js";

describe("sqlite catalog adapter", () => {
  it("does not import Neon HTTP or postgres.js", () => {
    const pkg = readFileSync(
      fileURLToPath(new URL("../package.json", import.meta.url)),
      "utf8",
    );
    expect(pkg).not.toMatch(/@neondatabase/);
    expect(pkg).not.toMatch(/"postgres"/);
    const d1 = readFileSync(new URL("./d1.ts", import.meta.url), "utf8");
    expect(d1).toMatch(/drizzle-orm\/d1/);
    expect(d1).not.toMatch(/neon-http/);
  });

  it("inserts a bot and selects it by id without a D1 bookmark", async () => {
    const { db, close } = createMigratedDb();
    try {
      await db.insert(user).values({
        id: "u1",
        name: "Ada",
        email: "ada@example.com",
      });
      await db.insert(organization).values({
        id: "ws1",
        name: "Office",
        slug: "office",
      });
      await db.insert(bots).values({
        id: "bot1",
        workspaceId: "ws1",
        userId: "u1",
        name: "Scout",
      });
      const [row] = await db
        .select({ id: bots.id, name: bots.name })
        .from(bots)
        .where(eq(bots.id, "bot1"))
        .limit(1);
      expect(row).toEqual({ id: "bot1", name: "Scout" });
    } finally {
      await close();
    }
  });

  it("round-trips message blocks as JSON", async () => {
    const { db, close } = createMigratedDb();
    try {
      await db.insert(user).values({
        id: "u1",
        name: "Ada",
        email: "ada@example.com",
      });
      await db.insert(organization).values({
        id: "ws1",
        name: "Office",
        slug: "office",
      });
      await db.insert(bots).values({
        id: "bot1",
        workspaceId: "ws1",
        userId: "u1",
        name: "Scout",
      });
      await db.insert(threads).values({
        id: "th1",
        workspaceId: "ws1",
        botId: "bot1",
      });
      await db.insert(messages).values({
        id: "m1",
        threadId: "th1",
        seq: 1,
        actorType: "user",
        actorId: "u1",
        blocks: [{ type: "text", text: "hello" }],
      });
      const [row] = await db
        .select({ blocks: messages.blocks })
        .from(messages)
        .limit(1);
      expect(row?.blocks).toEqual([{ type: "text", text: "hello" }]);
    } finally {
      await close();
    }
  });
});
