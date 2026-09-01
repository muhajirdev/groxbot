import { describe, expect, it } from "vitest";
import { composerBannerError, humanizeRunError } from "./errors";

describe("composerBannerError", () => {
  it("clears a run error once the next turn is in flight", () => {
    expect(
      composerBannerError({
        inFlight: true,
        agentError: "error code: 1031",
        connectionError: "",
        persisted: "error code: 1031",
      }),
    ).toBe("");
  });

  it("clears a persisted run error after the chat recovers", () => {
    expect(
      composerBannerError({
        inFlight: false,
        agentError: "",
        connectionError: "",
        persisted: "error code: 1031",
      }),
    ).toBe("");
  });

  it("keeps the model-key gate until the user can send", () => {
    const message =
      "Add a model key, or use Groxbot’s included gateway, to talk to teammates.";
    expect(
      composerBannerError({
        inFlight: false,
        agentError: "",
        connectionError: "",
        persisted: message,
      }),
    ).toBe(message);
  });
});

describe("humanizeRunError", () => {
  it("rewrites Cloudflare error-code lines", () => {
    expect(humanizeRunError("error code: 1031")).toBe(
      "Could not reach this teammate. Try sending again.",
    );
  });
});
