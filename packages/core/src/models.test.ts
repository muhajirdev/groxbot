import {
  HOSTED_STARTER_MODEL,
  hostedCloudflareGateway,
} from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  applyHostedCloudflareEnv,
  encryptionSecret,
  fallbackRunnableModel,
  userHasModelCredentials,
} from "./models.js";
import { redactSecrets } from "./secret-box.js";
import { emptyModelUsage } from "./usage.js";

describe("userHasModelCredentials", () => {
  it("accepts stored rows", () => {
    expect(userHasModelCredentials(1)).toBe(true);
  });

  it("rejects an empty workspace", () => {
    expect(userHasModelCredentials(0)).toBe(false);
  });
});

describe("encryptionSecret", () => {
  it("refuses the development fallback in production", () => {
    expect(() => encryptionSecret({}, true)).toThrow(/required in production/);
    expect(() =>
      encryptionSecret({ ENCRYPTION_KEY: "too-short" }, true),
    ).toThrow(/32 characters/);
  });

  it("uses ENCRYPTION_KEY when long enough", () => {
    const key = "k".repeat(32);
    expect(encryptionSecret({ ENCRYPTION_KEY: key }, true)).toBe(key);
  });
});

describe("redactSecrets", () => {
  it("strips provider keys from error text", () => {
    expect(
      redactSecrets("upstream 401 sk-ant-abcdefghijklmnopqrstuvwxyz"),
    ).toBe("upstream 401 sk-ant-…");
  });
});

describe("hosted Cloudflare overlay", () => {
  it("injects Groxbot’s gateway and leaves workspace BYOK in place", () => {
    const hosted = hostedCloudflareGateway({
      GROXBOT_HOSTED_AI: "1",
    });
    const empty: NodeJS.ProcessEnv = {};
    expect(applyHostedCloudflareEnv(empty, hosted)).toBe(true);
    expect(empty.GROXBOT_HOSTED_AI).toBe("1");
    expect(empty.CLOUDFLARE_AI_GATEWAY_ID).toBe("default");
    expect(empty.CLOUDFLARE_API_TOKEN).toBeUndefined();

    const workspace: NodeJS.ProcessEnv = {
      CLOUDFLARE_ACCOUNT_ID: "own-acct",
      CLOUDFLARE_API_TOKEN: "own-token",
    };
    expect(applyHostedCloudflareEnv(workspace, hosted)).toBe(false);
    expect(workspace.CLOUDFLARE_API_TOKEN).toBe("own-token");
    expect(workspace.GROXBOT_HOSTED_AI).toBeUndefined();
  });

  it("falls back to the hosted Workers AI starter when OpenRouter has no key", () => {
    expect(
      fallbackRunnableModel(
        "openrouter/deepseek/deepseek-v4-flash",
        ["cloudflare"],
        "gateway",
        true,
      ),
    ).toBe(HOSTED_STARTER_MODEL);
    expect(emptyModelUsage.requests).toBe(0);
  });
});
