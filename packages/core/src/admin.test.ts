import { billingPlans, bots, member, organization, rooms, user } from "@groxbot/db";
import { createMigratedDb } from "@groxbot/db/node";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  AdminDeleteError,
  commitAdminUserDelete,
  isAdminHiddenEmail,
  listAdminUsers,
  listAdminWorkspaces,
  planAdminUserDelete,
  purgeDeploymentData,
} from "./admin.js";

async function seedSoloUser() {
  const handles = createMigratedDb();
  const { db } = handles;
  await db.insert(user).values({
    id: "u1",
    name: "Ada",
    email: "ada@groxbot.com",
  });
  await db.insert(user).values({
    id: "u2",
    name: "Guest",
    email: "guest@example.com",
  });
  await db.insert(organization).values({
    id: "ws1",
    name: "Ada Co",
    slug: "ada",
  });
  await db.insert(member).values({
    id: "m1",
    organizationId: "ws1",
    userId: "u1",
    role: "owner",
  });
  await db.insert(rooms).values({
    id: "room-home",
    workspaceId: "ws1",
    name: "Ada",
    createdByUserId: "u1",
  });
  await db.insert(bots).values({
    id: "bot1",
    workspaceId: "ws1",
    userId: "u1",
    name: "Scout",
    homeRoomId: "room-home",
  });
  await db.insert(billingPlans).values({
    plan: "pro",
    label: "Pro",
  });
  return handles;
}

describe("admin queries", () => {
  it("hides RFC 2606 example.com test mailboxes", () => {
    expect(isAdminHiddenEmail("guest-1788614776587@example.com")).toBe(true);
    expect(isAdminHiddenEmail("Guest@Example.COM")).toBe(true);
    expect(isAdminHiddenEmail("you@groxbot.com")).toBe(false);
    expect(isAdminHiddenEmail("not@sub.example.com")).toBe(false);
  });

  it("marks owner deletes as forbidden", () => {
    const error = new AdminDeleteError(
      "FORBIDDEN",
      "Cannot delete the deployment owner.",
    );
    expect(error.code).toBe("FORBIDDEN");
  });

  it("lists users without example.com mailboxes", async () => {
    const { db, close } = await seedSoloUser();
    try {
      const listed = await listAdminUsers(db, { limit: 20, offset: 0 });
      expect(listed.items.map((row) => row.email)).toEqual(["ada@groxbot.com"]);
      expect(listed.total).toBe(1);
    } finally {
      await close();
    }
  });

  it("deletes a sole-workspace user and leftover home room", async () => {
    const { db, close } = await seedSoloUser();
    try {
      const plan = await planAdminUserDelete(db, "u1");
      expect(plan.soleWorkspaceIds).toEqual(["ws1"]);
      await commitAdminUserDelete(
        db,
        plan.userId,
        plan.shared,
        plan.soleWorkspaceIds,
      );
      const [gone] = await db.select().from(user).where(eq(user.id, "u1"));
      expect(gone).toBeUndefined();
      const leftoverRooms = await db.select().from(rooms);
      expect(leftoverRooms).toEqual([]);
      const leftoverBots = await db.select().from(bots);
      expect(leftoverBots).toEqual([]);
    } finally {
      await close();
    }
  });

  it("purges users and workspaces but keeps billing_plans", async () => {
    const { db, close } = await seedSoloUser();
    try {
      const result = await purgeDeploymentData(db);
      expect(result.deletedUsers).toBe(2);
      expect(result.deletedWorkspaces).toBe(1);
      const users = await db.select().from(user);
      expect(users).toEqual([]);
      const orgs = await db.select().from(organization);
      expect(orgs).toEqual([]);
      const plans = await db.select().from(billingPlans);
      expect(plans).toHaveLength(1);
    } finally {
      await close();
    }
  });
});
