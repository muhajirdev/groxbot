import { describe, expect, it } from "vitest";
import {
  HOSTED_OFFICE_CONTEXT_WINDOW,
  isContextOverflowError,
  officeModelContextWindow,
} from "./office-compact.js";

describe("isContextOverflowError", () => {
  it("matches Cloudflare 8007 and provider context errors", () => {
    expect(
      isContextOverflowError(
        "8007: input 1098070 tokens > model context 1048576",
      ),
    ).toBe(true);
    expect(isContextOverflowError("maximum context length exceeded")).toBe(
      true,
    );
    expect(isContextOverflowError("The hosted model returned an empty reply")).toBe(
      false,
    );
  });
});

describe("officeModelContextWindow", () => {
  it("uses the real GLM 5.3 window, not the 128k stub", () => {
    expect(
      officeModelContextWindow({
        id: "workers-ai/@cf/zai-org/glm-5.3-flash",
        contextWindow: 128_000,
      }),
    ).toBe(HOSTED_OFFICE_CONTEXT_WINDOW);
  });

  it("keeps a large advertised window", () => {
    expect(
      officeModelContextWindow({
        id: "openrouter/anthropic/claude-sonnet-4",
        contextWindow: 200_000,
      }),
    ).toBe(200_000);
  });

  it("lifts a tiny Cloudflare catalog window to the hosted 1M", () => {
    expect(
      officeModelContextWindow({
        id: "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        contextWindow: 128_000,
      }),
    ).toBe(HOSTED_OFFICE_CONTEXT_WINDOW);
  });
});
