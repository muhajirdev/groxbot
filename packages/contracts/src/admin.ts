import * as z from "zod";
import { Id } from "./ids.js";

export const AdminStatsSchema = z.object({
  userCount: z.number().int().nonnegative(),
  workspaceCount: z.number().int().nonnegative(),
  botCount: z.number().int().nonnegative(),
  activeBotCount: z.number().int().nonnegative(),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const AdminListInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  search: z.string().max(120).optional(),
});
export type AdminListInput = z.infer<typeof AdminListInput>;

export const AdminUserSchema = z.object({
  id: Id,
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  workspaceCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminUsersPageSchema = z.object({
  items: z.array(AdminUserSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type AdminUsersPage = z.infer<typeof AdminUsersPageSchema>;

export const AdminWorkspaceSchema = z.object({
  id: Id,
  name: z.string(),
  slug: z.string(),
  memberCount: z.number().int().nonnegative(),
  botCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type AdminWorkspace = z.infer<typeof AdminWorkspaceSchema>;

export const AdminWorkspacesPageSchema = z.object({
  items: z.array(AdminWorkspaceSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type AdminWorkspacesPage = z.infer<typeof AdminWorkspacesPageSchema>;

export const ADMIN_PURGE_CONFIRM = "DELETE ALL";

export const AdminPurgeInput = z.object({
  confirm: z.literal(ADMIN_PURGE_CONFIRM),
});
export type AdminPurgeInput = z.infer<typeof AdminPurgeInput>;

export const AdminPurgeResultSchema = z.object({
  deletedUsers: z.number().int().nonnegative(),
  deletedWorkspaces: z.number().int().nonnegative(),
  deletedR2Objects: z.number().int().nonnegative(),
  deletedAvatars: z.number().int().nonnegative(),
  destroyedRoomActors: z.number().int().nonnegative(),
  destroyedAppRuntimes: z.number().int().nonnegative(),
});
export type AdminPurgeResult = z.infer<typeof AdminPurgeResultSchema>;
