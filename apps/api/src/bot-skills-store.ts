/** Cloudflare-only. Excluded from `tsc`. Curated Skills store as a Code Mode connector. */
import { CodemodeConnector, type ConnectorTools } from "@cloudflare/codemode";
import {
  SKILLS_STORE_CATALOG,
  filterSkillsStore,
  getSkillsStoreListing,
} from "@groxbot/contracts";
import {
  connectorString,
  createSkillImportHttp,
  importOfficeSkills,
  KnowledgePathError,
  type KnowledgeDisk,
} from "@groxbot/core";

export class SkillsStoreConnector extends CodemodeConnector {
  constructor(
    ctx: DurableObjectState,
    env: unknown,
    private readonly disk: KnowledgeDisk,
    private readonly officeId: () => string,
  ) {
    super(ctx, env as never);
  }

  override name() {
    return "skills_store";
  }

  protected override instructions() {
    return [
      "Curated Agent Skills store (trusted GitHub / skills.sh packages).",
      "Search with skills_store.search, then install with skills_store.install({ id }) — install needs approval.",
      "Installed skills land in office knowledge as skills/<name>/SKILL.md and show up in <available_skills> on the next turn.",
      "Not Plugins. Hire a teammate with bots.search / bots.hire, not this store. Prefer the store over inventing a playbook when a listing already fits.",
    ].join(" ");
  }

  protected override tools(): ConnectorTools {
    return {
      search: {
        description:
          "Search the curated Skills store. Call skills_store.search({ query }) or pass a query string. Optional category. Returns id, name, blurb, category, trust, source — then install by id.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", maxLength: 200 },
            category: { type: "string", maxLength: 80 },
            limit: { type: "integer", minimum: 1, maximum: 20 },
          },
        },
        replay: "reexecute",
        execute: async (args) => {
          const query = optionalString(args, "query", true) ?? "";
          const category = optionalString(args, "category") || null;
          const limit = numberArg(args, "limit") ?? 12;
          const hits = filterSkillsStore(
            SKILLS_STORE_CATALOG,
            query,
            category,
          ).slice(0, limit);
          return {
            count: hits.length,
            categories: [
              ...new Set(SKILLS_STORE_CATALOG.map((row) => row.category)),
            ],
            skills: hits.map((row) => ({
              id: row.id,
              name: row.name,
              blurb: row.blurb,
              category: row.category,
              trust: row.trust,
              source: row.source,
            })),
          };
        },
      },
      install: {
        description:
          "Install a store listing into office knowledge by id (from search). Needs approval. Copies SKILL.md under skills/<name>/.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", minLength: 1, maxLength: 80 },
          },
          required: ["id"],
        },
        requiresApproval: true,
        execute: async (args) => {
          const id = stringArg(args, "id", true);
          const listing = getSkillsStoreListing(id);
          if (!listing) {
            throw new KnowledgePathError(`Unknown store skill: ${id}`);
          }
          const result = await importOfficeSkills(
            this.disk,
            this.workspaceId(),
            { source: listing.source },
            createSkillImportHttp(),
          );
          return {
            id: listing.id,
            imported: result.imported,
            skipped: result.skipped,
          };
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

function stringArg(args: unknown, key: string, positional = false): string {
  const value = optionalString(args, key, positional);
  if (!value) throw new KnowledgePathError();
  return value;
}

function optionalString(
  args: unknown,
  key: string,
  positional = false,
): string | undefined {
  const value = connectorString(args, key, positional);
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function numberArg(args: unknown, key: string): number | undefined {
  if (!args || typeof args !== "object" || Array.isArray(args)) return undefined;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
