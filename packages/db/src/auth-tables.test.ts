import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createMigratedDb } from "./node.js";
import {
  account,
  invitation,
  member,
  organization,
  session,
  user,
  verification,
} from "./schema/index.js";

/** Better Auth core + organization plugin tables used by `createAuth`. */
const BETTER_AUTH_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "organization",
  "member",
  "invitation",
] as const;

const drizzleDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../drizzle",
);

function drizzleSqlFiles(): string[] {
  return readdirSync(drizzleDir)
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort()
    .map((name) => path.join(drizzleDir, name));
}

function splitDrizzleSql(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith("-- Custom SQL"));
}

function createdTables(sql: string): Set<string> {
  const names = new Set<string>();
  for (const statement of splitDrizzleSql(sql)) {
    const match = statement.match(/CREATE TABLE(?: IF NOT EXISTS)? `([^`]+)`/i);
    if (match) names.add(match[1]);
  }
  return names;
}

function applyDrizzleSql(sqlite: Database.Database, sql: string) {
  for (const statement of splitDrizzleSql(sql)) {
    sqlite.exec(statement);
  }
}

describe("Better Auth D1 catalog tables", () => {
  it("lists every Better Auth table in Drizzle SQL migrations", () => {
    const found = new Set<string>();
    for (const file of drizzleSqlFiles()) {
      for (const name of createdTables(readFileSync(file, "utf8"))) {
        found.add(name);
      }
    }
    for (const name of BETTER_AUTH_TABLES) {
      expect(found, name).toContain(name);
    }
  });

  it("keeps a restore migration for catalogs that skipped empty auth tables", () => {
    const restore = readFileSync(
      path.join(drizzleDir, "0001_restore_better_auth_tables.sql"),
      "utf8",
    );
    expect(restore).toMatch(/CREATE TABLE IF NOT EXISTS `verification`/);
    for (const name of BETTER_AUTH_TABLES) {
      expect(restore).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS \`${name}\``),
      );
    }
  });

  it("inserts a magic-link verification row after migrate", async () => {
    const { db, close } = createMigratedDb();
    try {
      await db.insert(verification).values({
        id: "ver_1",
        identifier: "ada@example.com",
        value: "token-or-otp",
        expiresAt: new Date(Date.now() + 60_000),
      });
      const [row] = await db.select().from(verification);
      expect(row?.identifier).toBe("ada@example.com");
      expect(row?.value).toBe("token-or-otp");
    } finally {
      await close();
    }
  });

  it("creates verification when 0000 ran without that table", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    const sql0000 = readFileSync(
      path.join(drizzleDir, "0000_awesome_bushwacker.sql"),
      "utf8",
    );
    const withoutVerification = splitDrizzleSql(sql0000)
      .filter((statement) => !/CREATE TABLE `verification`/i.test(statement))
      .join(";\n");
    sqlite.exec(withoutVerification);
    const tablesBefore = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all() as { name: string }[];
    expect(tablesBefore.map((row) => row.name)).not.toContain("verification");

    applyDrizzleSql(
      sqlite,
      readFileSync(
        path.join(drizzleDir, "0001_restore_better_auth_tables.sql"),
        "utf8",
      ),
    );
    const insert = sqlite.prepare(
      `INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    insert.run("ver_1", "ada@example.com", "token", Date.now() + 60_000, Date.now(), Date.now());
    const row = sqlite
      .prepare(`SELECT identifier FROM verification WHERE id = ?`)
      .get("ver_1") as { identifier: string };
    expect(row.identifier).toBe("ada@example.com");
    sqlite.close();
  });

  it("round-trips user, session, and account after migrate", async () => {
    const { db, close } = createMigratedDb();
    try {
      await db.insert(user).values({
        id: "u1",
        name: "Ada",
        email: "ada@example.com",
      });
      await db.insert(session).values({
        id: "s1",
        token: "session-token",
        userId: "u1",
        expiresAt: new Date(Date.now() + 60_000),
      });
      await db.insert(account).values({
        id: "a1",
        accountId: "ada@example.com",
        providerId: "credential",
        issuer: "local:credential",
        userId: "u1",
      });
      await db.insert(organization).values({
        id: "ws1",
        name: "Office",
        slug: "office",
      });
      await db.insert(member).values({
        id: "m1",
        organizationId: "ws1",
        userId: "u1",
        role: "owner",
      });
      await db.insert(invitation).values({
        id: "inv1",
        organizationId: "ws1",
        email: "pat@example.com",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 86_400_000),
        inviterId: "u1",
      });
      const [sessionRow] = await db.select().from(session);
      const [memberRow] = await db.select().from(member);
      expect(sessionRow?.token).toBe("session-token");
      expect(memberRow?.role).toBe("owner");
    } finally {
      await close();
    }
  });
});
