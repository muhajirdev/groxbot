import {
  decodeComputerBytes,
  KnowledgeFileError,
  KnowledgePathError,
  KnowledgeShareError,
  downloadPublicKnowledge,
  readPublicKnowledge,
  type KnowledgeDisk,
} from "@groxbot/core";
import type { Database } from "@groxbot/db";
import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const PUBLIC_KNOWLEDGE_HEADERS = {
  "cache-control": "private, max-age=60",
  "x-robots-tag": "noindex",
} as const;

const INLINE_IMAGES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function contentDispositionForPublicFile(
  mediaType: string,
  filename: string,
): string {
  const type = mediaType.split(";")[0]?.trim().toLowerCase() ?? "";
  const inline = INLINE_IMAGES.has(type);
  const safe = filename.replace(/["\\/]/g, "_").slice(0, 180) || "download";
  return `${inline ? "inline" : "attachment"}; filename="${safe}"`;
}

export function mountPublicKnowledge(
  app: Hono,
  opts: { db: Database; disk?: KnowledgeDisk },
): void {
  app.get("/public/knowledge/:shareId", async (c) => {
    if (!opts.disk) {
      return publicKnowledgeResponse(
        c.json({ message: "Share not found." }, 404),
      );
    }
    try {
      const body = await readPublicKnowledge(
        opts.db,
        opts.disk,
        c.req.param("shareId"),
        c.req.query("path") ?? undefined,
      );
      return publicKnowledgeResponse(c.json(body));
    } catch (error) {
      return publicKnowledgeError(c, error);
    }
  });

  app.get("/public/knowledge/:shareId/raw", async (c) => {
    if (!opts.disk) {
      return publicKnowledgeResponse(
        c.json({ message: "Share not found." }, 404),
      );
    }
    try {
      const file = await downloadPublicKnowledge(
        opts.db,
        opts.disk,
        c.req.param("shareId"),
        c.req.query("path") ?? undefined,
      );
      const bytes = decodeComputerBytes(file.content);
      return new Response(bytes, {
        status: 200,
        headers: {
          ...PUBLIC_KNOWLEDGE_HEADERS,
          "content-type": file.mediaType || "application/octet-stream",
          "content-disposition": contentDispositionForPublicFile(
            file.mediaType,
            file.filename,
          ),
        },
      });
    } catch (error) {
      return publicKnowledgeError(c, error);
    }
  });
}

function publicKnowledgeResponse(response: Response): Response {
  for (const [key, value] of Object.entries(PUBLIC_KNOWLEDGE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

function publicKnowledgeError(
  c: { json: (body: unknown, status: ContentfulStatusCode) => Response },
  error: unknown,
): Response {
  if (error instanceof KnowledgeFileError) {
    return publicKnowledgeResponse(
      c.json({ message: error.message }, 404),
    );
  }
  if (
    error instanceof KnowledgePathError ||
    error instanceof KnowledgeShareError
  ) {
    return publicKnowledgeResponse(
      c.json({ message: error.message }, 400),
    );
  }
  throw error;
}
