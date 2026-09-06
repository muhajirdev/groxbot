import { describe, expect, it } from "vitest";
import { listAdminUsers, listAdminWorkspaces, purgeDeploymentData } from "./admin.js";

describe("admin queries", () => {
  it("exports list helpers", () => {
    expect(typeof listAdminUsers).toBe("function");
    expect(typeof listAdminWorkspaces).toBe("function");
    expect(typeof purgeDeploymentData).toBe("function");
  });
});
