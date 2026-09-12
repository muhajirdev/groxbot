import { describe, expect, it } from "vitest";
import { getUseCase } from "../data/use-cases";
import { HOME_JOBS, jobApp, jobDepartmentLabel } from "./home-jobs";

describe("home job strip", () => {
  it("ranks the first four jobs as the aha sentences", () => {
    expect(HOME_JOBS.slice(0, 4).map((job) => job.id)).toEqual([
      "drive-instagram",
      "reddit-digest",
      "gmail-knowledge",
      "site-privacy",
    ]);
    expect(HOME_JOBS[0]?.tokens.some((token) => token.kind === "bot")).toBe(
      true,
    );
    expect(
      HOME_JOBS[0]?.tokens.some(
        (token) => token.kind === "app" && token.slug === "instagram",
      ),
    ).toBe(true);
    expect(
      HOME_JOBS[1]?.tokens.some(
        (token) => token.kind === "icon" && token.icon === "clock",
      ),
    ).toBe(true);
    expect(
      HOME_JOBS[2]?.tokens.some(
        (token) => token.kind === "icon" && token.icon === "knowledge",
      ),
    ).toBe(true);
  });

  it("labels a department on every job and links a real use case", () => {
    for (const job of HOME_JOBS) {
      expect(jobDepartmentLabel(job.department).length).toBeGreaterThan(2);
      expect(getUseCase(job.useCaseSlug)?.slug).toBe(job.useCaseSlug);
    }
  });

  it("keeps every ranked job in one list", () => {
    expect(HOME_JOBS.length).toBeGreaterThan(12);
    expect(new Set(HOME_JOBS.map((job) => job.id)).size).toBe(HOME_JOBS.length);
    expect(jobApp("gmail").logo.length).toBeGreaterThan(0);
  });
});
