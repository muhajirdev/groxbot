import { describe, expect, it } from "vitest";
import {
  AdminDeleteError,
  isAdminHiddenEmail,
  listAdminUsers,
  listAdminWorkspaces,
  purgeDeploymentData,
} from "./admin.js";

describe("admin queries", () => {
  it("exports list helpers", () => {
    expect(typeof listAdminUsers).toBe("function");
    expect(typeof listAdminWorkspaces).toBe("function");
    expect(typeof purgeDeploymentData).toBe("function");
  });

  it("hides RFC 2606 example.com test mailboxes", () => {
    expect(isAdminHiddenEmail("guest-1788614776587@example.com")).toBe(true);
    expect(isAdminHiddenEmail("Guest@Example.COM")).toBe(true);
    expect(isAdminHiddenEmail("you@groxbot.com")).toBe(false);
    expect(isAdminHiddenEmail("not@sub.example.com")).toBe(false);
  });

  it("marks owner deletes as forbidden", () => {
    const error = new AdminDeleteError(
      "FORBIDDEN",
      "Cannot delete the deployment owner.",
    );
    expect(error.code).toBe("FORBIDDEN");
  });
});
