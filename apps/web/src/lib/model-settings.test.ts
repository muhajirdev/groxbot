import { CLOUDFLARE_PROVIDER, OPENROUTER_PROVIDER } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  canSaveCloudflareSettings,
  cloudflareSettingsDirty,
  modelKeyDraftsReady,
  modelKeySavePayload,
  providerSecretDraftsDirty,
} from "./model-settings";

describe("providerSecretDraftsDirty", () => {
  it("ignores blank and Cloudflare drafts", () => {
    expect(providerSecretDraftsDirty({})).toBe(false);
    expect(providerSecretDraftsDirty({ [OPENROUTER_PROVIDER]: "  " })).toBe(
      false,
    );
    expect(providerSecretDraftsDirty({ [CLOUDFLARE_PROVIDER]: "token" })).toBe(
      false,
    );
    expect(
      providerSecretDraftsDirty({ [OPENROUTER_PROVIDER]: "sk-or-key" }),
    ).toBe(true);
  });
});

describe("cloudflareSettingsDirty", () => {
  it("treats token, account, or gateway edits as dirty", () => {
    expect(
      cloudflareSettingsDirty({
        accountId: "acct",
        gatewayId: "gw",
        savedAccountId: "acct",
        savedGatewayId: "gw",
      }),
    ).toBe(false);
    expect(
      cloudflareSettingsDirty({
        draftToken: "tok",
        accountId: "acct",
        gatewayId: "gw",
        savedAccountId: "acct",
        savedGatewayId: "gw",
      }),
    ).toBe(true);
    expect(
      cloudflareSettingsDirty({
        accountId: "next",
        gatewayId: "gw",
        savedAccountId: "acct",
        savedGatewayId: "gw",
      }),
    ).toBe(true);
  });
});

describe("canSaveCloudflareSettings", () => {
  it("needs both fields for a new key", () => {
    expect(
      canSaveCloudflareSettings({
        draftToken: "tok",
        accountId: "",
        configured: false,
      }),
    ).toBe(false);
    expect(
      canSaveCloudflareSettings({
        draftToken: "tok",
        accountId: "acct",
        configured: false,
      }),
    ).toBe(true);
  });

  it("lets a configured row patch one field", () => {
    expect(
      canSaveCloudflareSettings({
        accountId: "acct",
        configured: true,
      }),
    ).toBe(true);
  });
});

describe("modelKeySavePayload", () => {
  it("sends ready drafts only", () => {
    expect(
      modelKeySavePayload({
        drafts: { [OPENROUTER_PROVIDER]: "sk-or-key" },
        accountId: "",
        gatewayId: "",
        cloudflareConfigured: false,
      }),
    ).toEqual([{ provider: OPENROUTER_PROVIDER, secret: "sk-or-key" }]);
  });

  it("holds a half-filled Cloudflare row", () => {
    expect(
      modelKeyDraftsReady({
        drafts: { [CLOUDFLARE_PROVIDER]: "tok" },
        accountId: "",
        gatewayId: "gw",
        savedGatewayId: "gw",
        cloudflareConfigured: false,
      }),
    ).toBe(false);
    expect(
      modelKeySavePayload({
        drafts: { [CLOUDFLARE_PROVIDER]: "tok" },
        accountId: "",
        gatewayId: "gw",
        savedGatewayId: "gw",
        cloudflareConfigured: false,
      }),
    ).toEqual([]);
  });
});
