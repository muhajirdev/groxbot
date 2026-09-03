import {
  decodeAvatarPayload,
  publishedProfileImage,
  removeAvatar,
  writeAvatar,
} from "@groxbot/core";
import { user } from "@groxbot/db";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import type { RpcContext } from "./context.js";
import { requireUser } from "./session.js";

export function apiOriginFor(context: RpcContext): string {
  return (context.env.apiUrl ?? context.env.authUrl).replace(/\/$/, "");
}

export function publishedAccountImage(
  context: RpcContext,
  row: { id: string; image: string | null; updatedAt: Date | null },
): string | null {
  return publishedProfileImage(
    row.image,
    row.id,
    row.updatedAt?.getTime() ?? 0,
    apiOriginFor(context),
  );
}

export async function loadAccountRow(context: RpcContext, userId: string) {
  const [row] = await context.db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row ?? null;
}

export async function updateAccount(
  context: RpcContext,
  input: { name?: string; image?: { content: string } | null },
) {
  if (input.name === undefined && input.image === undefined) {
    throw new ORPCError("BAD_REQUEST", { message: "Add a name or a photo." });
  }
  const session = await requireUser(context);
  const current = await loadAccountRow(context, session.userId);
  if (!current) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in" });
  }

  let name = current.name;
  let image = current.image;
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new ORPCError("BAD_REQUEST", { message: "Add a name." });
    }
    name = trimmed.slice(0, 80);
  }
  if (input.image === null) {
    if (context.avatars) {
      await removeAvatar(context.avatars, session.userId);
    }
    image = null;
  } else if (input.image) {
    if (!context.avatars) {
      throw new ORPCError("FAILED_PRECONDITION", {
        message: "Photo uploads are not configured.",
      });
    }
    let bytes: Uint8Array;
    try {
      bytes = decodeAvatarPayload(input.image.content);
    } catch (caught) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          caught instanceof Error ? caught.message : "Could not read that photo.",
      });
    }
    try {
      image = await writeAvatar(context.avatars, session.userId, bytes);
    } catch (caught) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          caught instanceof Error ? caught.message : "Could not save that photo.",
      });
    }
  }

  const now = new Date();
  await context.db
    .update(user)
    .set({ name, image, updatedAt: now })
    .where(eq(user.id, session.userId));

  if (context.auth) {
    try {
      await context.auth.api.updateUser({
        body: { name, image: image ?? undefined },
        headers: context.headers ?? new Headers(),
      });
    } catch {
      // Cookie cache can lag; me() and members read Postgres.
    }
  }

  return {
    userId: session.userId,
    name,
    email: current.email,
    image: publishedProfileImage(image, session.userId, now.getTime(), apiOriginFor(context)),
  };
}
