/** Cloudflare-only. Excluded from `tsc`. Office library as a Code Mode connector. */
import { CodemodeConnector, type ConnectorTools } from "@cloudflare/codemode";
import {
  type KnowledgeDisk,
  KnowledgePathError,
  listKnowledge,
  listKnowledgeBacklinks,
  readKnowledge,
  readKnowledgeMany,
  removeKnowledge,
  searchKnowledge,
  writeKnowledge,
} from "@groxbot/core";

const PATH = {
  type: "string",
  minLength: 1,
  maxLength: 240,
} as const;

export class KnowledgeConnector extends CodemodeConnector {
  constructor(
    ctx: DurableObjectState,
    env: unknown,
    private readonly disk: KnowledgeDisk,
    private readonly officeId: () => string,
  ) {
    super(ctx, env as never);
  }

  override name() {
    return "knowledge";
  }

  protected override instructions() {
    return [
      "Shared office knowledge — not this computer.",
      "Search first, then read. Write playbooks at skills/<name>/SKILL.md (YAML name + description). Patch an existing playbook before creating one.",
      "After a real write, mention that path in one short line in the thread. Don't announce a save you didn't make.",
      "Markdown links are office-root paths: [constraints](how-we-work/constraints.md). Not ../, not [[wikilinks]].",
    ].join(" ");
  }

  protected override tools(): ConnectorTools {
    return {
      search: {
        description:
          "Search office knowledge by title, path, and markdown body. Returns ranked hits with snippets — then read the paths you need. truncated means the office has more than 800 files; only those are indexed.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", minLength: 1, maxLength: 200 },
            limit: { type: "integer", minimum: 1, maximum: 12 },
          },
          required: ["query"],
        },
        replay: "reexecute",
        execute: async (args) => {
          const query = stringArg(args, "query");
          const limit = numberArg(args, "limit");
          return searchKnowledge(this.disk, this.workspaceId(), query, limit);
        },
      },
      list: {
        description:
          "List files in this office’s knowledge base. Use the returned paths in markdown links. truncated means more than 800 files exist.",
        inputSchema: { type: "object", properties: {} },
        replay: "reexecute",
        execute: async () => {
          const listed = await listKnowledge(this.disk, this.workspaceId());
          return {
            truncated: listed.truncated,
            entries: listed.entries.map((row) => ({
              path: row.path,
              title: row.title,
              description: row.description,
            })),
          };
        },
      },
      read: {
        description:
          "Read one office knowledge file. Path is the full office-root path, e.g. skills/weekly-update/SKILL.md.",
        inputSchema: {
          type: "object",
          properties: { path: PATH },
          required: ["path"],
        },
        replay: "reexecute",
        execute: async (args) => {
          const file = await readKnowledge(
            this.disk,
            this.workspaceId(),
            stringArg(args, "path"),
          );
          return {
            path: file.path,
            title: file.title,
            description: file.description,
            content: file.content,
            encoding: file.encoding,
            truncated: file.truncated,
            backlinks: file.backlinks,
          };
        },
      },
      readMany: {
        description:
          "Read up to 8 office knowledge files in one call. Prefer this after search.",
        inputSchema: {
          type: "object",
          properties: {
            paths: {
              type: "array",
              items: PATH,
              minItems: 1,
              maxItems: 8,
            },
          },
          required: ["paths"],
        },
        replay: "reexecute",
        execute: async (args) => {
          const paths = stringArrayArg(args, "paths");
          return readKnowledgeMany(this.disk, this.workspaceId(), paths);
        },
      },
      write: {
        description:
          "Save a file to the office knowledge base so every teammate can use it. Not this computer. A folder with SKILL.md (YAML name + description) is a reusable playbook — prefer skills/<name>/. After a successful write, mention that path in one short line in the thread. Link other office files with [label](path/from/office/root.md).",
        inputSchema: {
          type: "object",
          properties: {
            path: PATH,
            content: { type: "string", minLength: 1, maxLength: 64_000 },
          },
          required: ["path", "content"],
        },
        execute: async (args) => {
          const saved = await writeKnowledge(this.disk, this.workspaceId(), {
            path: stringArg(args, "path"),
            content: stringArg(args, "content"),
          });
          return { path: saved.path };
        },
      },
      backlinks: {
        description:
          "List office files that link to this path with [label](this-path).",
        inputSchema: {
          type: "object",
          properties: { path: PATH },
          required: ["path"],
        },
        replay: "reexecute",
        execute: async (args) => {
          const sources = await listKnowledgeBacklinks(
            this.disk,
            this.workspaceId(),
            stringArg(args, "path"),
          );
          return { sources };
        },
      },
      remove: {
        description:
          "Delete an office knowledge file or folder. Needs approval.",
        inputSchema: {
          type: "object",
          properties: { path: PATH },
          required: ["path"],
        },
        requiresApproval: true,
        execute: async (args) => {
          const path = stringArg(args, "path");
          await removeKnowledge(this.disk, this.workspaceId(), path);
          return { path };
        },
      },
    };
  }

  private workspaceId(): string {
    const id = this.officeId().trim();
    if (!id) throw new KnowledgePathError("Unknown office.");
    return id;
  }
}

function stringArg(args: unknown, key: string): string {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new KnowledgePathError();
  }
  const value = (args as Record<string, unknown>)[key];
  if (typeof value !== "string" || !value.trim())
    throw new KnowledgePathError();
  return value;
}

function numberArg(args: unknown, key: string): number | undefined {
  if (!args || typeof args !== "object" || Array.isArray(args))
    return undefined;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function stringArrayArg(args: unknown, key: string): string[] {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new KnowledgePathError();
  }
  const value = (args as Record<string, unknown>)[key];
  if (!Array.isArray(value)) throw new KnowledgePathError();
  return value.filter((row): row is string => typeof row === "string");
}
