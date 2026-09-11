import { describe, expect, it, vi } from "vitest";
import {
  CURSOR_CLOUD_API,
  CURSOR_KEY_REQUIRED_MESSAGE,
  createCursorCloudAgent,
  cursorAuthHeaders,
  cursorCreateBody,
  cursorParkedCopy,
  cursorPollDelayMs,
  cursorProofCopy,
  getCursorCloudRun,
  isCursorRunTerminal,
  normalizeGithubRepoUrl,
  parseCursorDispatchPayload,
  parseCursorLaunchInput,
  parseCursorLaunchResponse,
  parseCursorRunResponse,
  requireCursorApiKey,
} from "./cursor-cloud.js";

describe("Cursor Cloud Agents client", () => {
  it("normalizes GitHub owner/repo onto https://github.com", () => {
    expect(normalizeGithubRepoUrl("muhajirdev/groxbot")).toBe(
      "https://github.com/muhajirdev/groxbot",
    );
    expect(
      normalizeGithubRepoUrl("https://github.com/muhajirdev/groxbot.git"),
    ).toBe("https://github.com/muhajirdev/groxbot");
  });

  it("refuses a non-GitHub URL so Groxbot never clones locally", () => {
    expect(() => normalizeGithubRepoUrl("https://gitlab.com/org/repo")).toThrow(
      /GitHub repo/,
    );
  });

  it("builds a v1 create body with autoCreatePR", () => {
    const parsed = parseCursorLaunchInput({
      repo: "acme/app",
      prompt: "Fix the failing tests",
      ref: "main",
    });
    expect(cursorCreateBody(parsed)).toEqual({
      prompt: { text: "Fix the failing tests" },
      repos: [{ url: "https://github.com/acme/app", startingRef: "main" }],
      autoCreatePR: true,
    });
  });

  it("parses create and terminal run payloads", () => {
    const launch = parseCursorLaunchResponse(
      {
        agent: {
          id: "bc-1",
          name: "Fix tests",
          url: "https://cursor.com/agents/bc-1",
          latestRunId: "run-1",
        },
        run: { id: "run-1", status: "CREATING" },
      },
      "https://github.com/acme/app",
    );
    expect(launch).toMatchObject({
      agentId: "bc-1",
      runId: "run-1",
      repo: "https://github.com/acme/app",
    });
    const run = parseCursorRunResponse({
      id: "run-1",
      agentId: "bc-1",
      status: "FINISHED",
      result: "Added tests.",
      git: {
        branches: [
          {
            repoUrl: "github.com/acme/app",
            branch: "cursor/fix-tests",
            prUrl: "https://github.com/acme/app/pull/12",
          },
        ],
      },
    });
    expect(isCursorRunTerminal(run.status)).toBe(true);
    expect(cursorProofCopy({ ...run, repo: launch.repo })).toBe(
      "Cursor opened https://github.com/acme/app/pull/12",
    );
  });

  it("parks I'm-on-it copy for the room, not a cursor.com cockpit", () => {
    expect(cursorParkedCopy("https://github.com/acme/app")).toBe(
      "I'm on it — Cursor is coding in github.com/acme/app.",
    );
    expect(
      cursorProofCopy({ repo: "https://github.com/acme/app", status: "ERROR" }),
    ).toMatch(/failed/);
  });

  it("backs off poll delay and keeps the dispatch payload", () => {
    expect(cursorPollDelayMs(0)).toBe(20_000);
    expect(cursorPollDelayMs(2)).toBe(60_000);
    expect(
      parseCursorDispatchPayload({
        agentId: "bc-1",
        runId: "run-1",
        repo: "https://github.com/acme/app",
        prompt: "Fix tests",
        attempt: 3,
      }),
    ).toMatchObject({ attempt: 3, agentId: "bc-1" });
  });

  it("requires a BYOK key and posts Bearer HTTP from the Worker", async () => {
    expect(() => requireCursorApiKey({})).toThrow(CURSOR_KEY_REQUIRED_MESSAGE);
    expect(cursorAuthHeaders("key_test").Authorization).toBe("Bearer key_test");
    const fetchFn = vi.fn(async (url: string, init?: { body?: string }) => {
      expect(url).toBe(`${CURSOR_CLOUD_API}/agents`);
      expect(JSON.parse(init?.body ?? "")).toMatchObject({
        autoCreatePR: true,
      });
      return new Response(
        JSON.stringify({
          agent: { id: "bc-9", url: "https://cursor.com/agents/bc-9" },
          run: { id: "run-9" },
        }),
        { status: 201 },
      );
    });
    const launched = await createCursorCloudAgent({
      apiKey: "key_test",
      repo: "acme/app",
      prompt: "Add a README",
      fetch: fetchFn,
    });
    expect(launched.agentId).toBe("bc-9");
    const runFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          id: "run-9",
          agentId: "bc-9",
          status: "FINISHED",
          git: {
            branches: [{ prUrl: "https://github.com/acme/app/pull/1" }],
          },
        }),
        { status: 200 },
      );
    });
    const run = await getCursorCloudRun({
      apiKey: "key_test",
      agentId: "bc-9",
      runId: "run-9",
      fetch: runFetch,
    });
    expect(run.prUrl).toBe("https://github.com/acme/app/pull/1");
  });
});
