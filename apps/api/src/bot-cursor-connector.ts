/** Cloudflare-only. Excluded from `tsc`. Dispatch Cursor Cloud Agents from Code Mode. */
import { CodemodeConnector, type ConnectorTools } from "@cloudflare/codemode";
import { connectorString } from "@groxbot/core";

export type CursorCloudHost = {
  launchCursorAgent(input: {
    repo: string;
    prompt: string;
    ref?: string;
  }): Promise<unknown>;
};

export class CursorConnector extends CodemodeConnector {
  constructor(
    ctx: DurableObjectState,
    env: unknown,
    private readonly host: () => CursorCloudHost,
  ) {
    super(ctx, env as never);
  }

  override name() {
    return "cursor";
  }

  protected override instructions() {
    return [
      "Dispatch a Cursor Cloud Agent. It clones GitHub, codes, and opens a PR.",
      "Call cursor.launch({ repo, prompt }) — needs approval. repo is owner/repo or a github.com URL.",
      "Park “I’m on it” in this room. Do not clone onto this computer. Do not stream the IDE.",
      "The pull request lands in this thread when Cursor finishes. Not a second teammate.",
    ].join(" ");
  }

  protected override tools(): ConnectorTools {
    return {
      launch: {
        description:
          "Send repo + prompt to Cursor Cloud Agents. Cursor clones GitHub and opens a PR. Needs approval. Returns parked — the PR is posted in this room later. Not this computer.",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", minLength: 1, maxLength: 240 },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            ref: { type: "string", maxLength: 200 },
          },
          required: ["repo", "prompt"],
        },
        requiresApproval: true,
        execute: async (args) =>
          this.host().launchCursorAgent({
            repo: stringArg(args, "repo", true),
            prompt: stringArg(args, "prompt"),
            ref: optionalString(args, "ref"),
          }),
      },
    };
  }
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

function stringArg(args: unknown, key: string, positional = false): string {
  return optionalString(args, key, positional) ?? "";
}
