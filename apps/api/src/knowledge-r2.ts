import type { KnowledgeDisk, KnowledgeObject } from "@groxbot/core";

type R2Listed = {
  objects: Array<{ key: string; size: number; uploaded: Date }>;
  truncated: boolean;
  cursor?: string;
};

/** Minimal R2 surface. Wrangler local and the Worker binding both match. */
export type KnowledgeBucket = {
  list(options: {
    prefix: string;
    limit?: number;
    cursor?: string;
  }): Promise<R2Listed>;
  get(key: string): Promise<{
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
  } | null>;
  put(
    key: string,
    value: string | ArrayBuffer | Uint8Array | ArrayBufferView,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
};

const LIST_PAGE = 1000;
const LIST_CAP = 800;

export function r2KnowledgeDisk(bucket: KnowledgeBucket): KnowledgeDisk {
  return {
    async list(prefix) {
      const rows: KnowledgeObject[] = [];
      let cursor: string | undefined;
      do {
        const page = await bucket.list({
          prefix,
          limit: LIST_PAGE,
          cursor,
        });
        for (const object of page.objects) {
          rows.push({
            key: object.key,
            size: object.size,
            uploaded: object.uploaded,
          });
          if (rows.length >= LIST_CAP) return rows;
        }
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return rows;
    },
    async getText(key) {
      const object = await bucket.get(key);
      return object ? object.text() : null;
    },
    async getBytes(key) {
      const object = await bucket.get(key);
      if (!object) return null;
      return new Uint8Array(await object.arrayBuffer());
    },
    async put(key, content, contentType) {
      await bucket.put(key, content, {
        httpMetadata: contentType ? { contentType } : undefined,
      });
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}
