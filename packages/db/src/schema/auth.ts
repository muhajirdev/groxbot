import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { bool, timestampMs, timestampMsNow } from "./columns.js";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: bool("email_verified"),
  image: text("image"),
  createdAt: timestampMsNow("created_at"),
  updatedAt: timestampMsNow("updated_at"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestampMs("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestampMsNow("created_at"),
  updatedAt: timestampMsNow("updated_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
});

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    /** Better Auth 1.7 account identity (`local:oauth:google`, `local:credential`, …). */
    issuer: text("issuer").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestampMs("access_token_expires_at"),
    refreshTokenExpiresAt: timestampMs("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestampMsNow("created_at"),
    updatedAt: timestampMsNow("updated_at"),
  },
  (t) => [uniqueIndex("account_issuer_account_id").on(t.issuer, t.accountId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestampMs("expires_at").notNull(),
  createdAt: timestampMs("created_at").$defaultFn(() => new Date()),
  updatedAt: timestampMs("updated_at").$defaultFn(() => new Date()),
});

export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestampMsNow("created_at"),
  metadata: text("metadata"),
});

export const member = sqliteTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestampMsNow("created_at"),
  },
  (t) => [uniqueIndex("member_org_user").on(t.organizationId, t.userId)],
);

export const invitation = sqliteTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull(),
  expiresAt: timestampMs("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestampMsNow("created_at"),
});

export const deploymentSettings = sqliteTable("deployment_settings", {
  id: text("id").primaryKey().default("default"),
  ownerUserId: text("owner_user_id"),
  createdAt: timestampMsNow("created_at"),
  updatedAt: timestampMsNow("updated_at"),
});
