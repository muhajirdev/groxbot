import { describe, expect, it } from "vitest";
import {
  coerceCutoverRow,
  splitBindRows,
  sqliteJson,
  sqliteTimestamp,
} from "./cutover.js";
import { createMigratedDb } from "./node.js";
import { bots, organization, rooms, user } from "./schema/index.js";

describe("cutover transform", () => {
  it("coerces timestamptz and jsonb dump values", () => {
    expect(sqliteTimestamp("2026-01-02T03:04:05.000Z")).toBe(
      Date.parse("2026-01-02T03:04:05.000Z"),
    );
    expect(sqliteJson({ type: "text", text: "hi" })).toBe(
      JSON.stringify({ type: "text", text: "hi" }),
    );
    const row = coerceCutoverRow({
      id: "bot1",
      created_at: "2026-01-02T03:04:05.000Z",
      blocks: [{ type: "text" }],
      email_verified: true,
    });
    expect(row.created_at).toBe(Date.parse("2026-01-02T03:04:05.000Z"));
    expect(row.blocks).toBe(JSON.stringify([{ type: "text" }]));
    expect(row.email_verified).toBe(1);
  });

  it("splits inserts under the 100 bound-parameter cap", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ id: String(i) }));
    const chunks = splitBindRows(rows, 5, 100);
    expect(chunks.every((chunk) => chunk.length * 5 <= 100)).toBe(true);
    expect(chunks.flat().length).toBe(40);
  });

  it("keeps workspace and bot ids after a fixture insert", async () => {
    const { db, close } = createMigratedDb();
    try {
      await db.insert(user).values({
        id: "user-fixture",
        name: "Pat",
        email: "pat@example.com",
      });
      await db.insert(organization).values({
        id: "ws-fixture",
        name: "Acme",
        slug: "acme",
      });
      await db.insert(rooms).values({
        id: "room-home",
        workspaceId: "ws-fixture",
        name: "Pat",
        createdByUserId: "user-fixture",
      });
      await db.insert(bots).values({
        id: "bot-fixture",
        workspaceId: "ws-fixture",
        userId: "user-fixture",
        name: "Scout",
        homeRoomId: "room-home",
      });
      const [bot] = await db.select().from(bots);
      expect(bot?.id).toBe("bot-fixture");
      expect(bot?.workspaceId).toBe("ws-fixture");
      expect(bot?.homeRoomId).toBe("room-home");
    } finally {
      await close();
    }
  });
});
