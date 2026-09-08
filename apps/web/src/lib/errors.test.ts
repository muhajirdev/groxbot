import { describe, expect, it } from "vitest";
import {
  composerBannerError,
  humanizeRunError,
  isHostedPlanError,
} from "./errors";

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
    expect(
      composerBannerError({
        inFlight: false,
        agentError: "",
        connectionError: "",
        persisted: message,
        needsModel: false,
      }),
    ).toBe("");
  });

  it("ignores a hire-race model error when the workspace already has a gateway", () => {
    const message =
      "Add a model key, or use Groxbot’s included gateway, to talk to teammates.";
    expect(
      composerBannerError({
        inFlight: false,
        agentError: message,
        connectionError: "",
        persisted: "",
        needsModel: false,
      }),
    ).toBe("");
    expect(
      composerBannerError({
        inFlight: false,
        agentError: message,
        connectionError: "WebSocket connection failed.",
        persisted: message,
        needsModel: false,
        warming: true,
      }),
    ).toBe("");
  });

  it("hides socket and model-key noise while the room session is warming", () => {
    const message =
      "Add a model key, or use Groxbot’s included gateway, to talk to teammates.";
    expect(
      composerBannerError({
        inFlight: false,
        agentError: message,
        connectionError: "WebSocket connection failed.",
        persisted: message,
        warming: true,
      }),
    ).toBe("");
  });

  it("hides hosted-plan errors so the subscribe popup can own them", () => {
    const message = "Subscribe to Pro to use this workspace.";
    expect(isHostedPlanError(message)).toBe(true);
    expect(
      composerBannerError({
        inFlight: false,
        agentError: message,
        connectionError: "",
        persisted: "",
      }),
    ).toBe("");
    expect(
      composerBannerError({
        inFlight: false,
        agentError: "",
        connectionError: "",
        persisted: message,
      }),
    ).toBe("");
  });
});

describe("humanizeRunError", () => {
  it("rewrites Cloudflare error-code lines", () => {
    expect(humanizeRunError("error code: 1031")).toBe(
      "Could not reach this teammate. Try sending again.",
    );
  });

  it("rewrites empty 401 handshake failures", () => {
    expect(humanizeRunError("401 status code (no body)")).toBe(
      "Could not reach this teammate. Reload and try again.",
    );
  });
});
