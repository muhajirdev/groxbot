import type { ThreadMessage, WorkspaceApp } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { mergeWorkspaceApps } from "./workspace-apps";

function message(
  id: string,
  createdAt: string,
  title: string,
  appId = "a1",
): ThreadMessage {
  return {
    id,
    seq: 1,
    actorType: "bot",
    actorId: "bot_1",
    runId: null,
    createdAt,
    blocks: [{ kind: "app", appId, templateId: "docs", title }],
  };
}

describe("mergeWorkspaceApps", () => {
  it("returns listed apps when the thread has no cards", () => {
    const listed: WorkspaceApp[] = [
      {
        id: "a1",
        templateId: "slides",
        title: "Q3",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    expect(mergeWorkspaceApps(listed, [])).toEqual(listed);
  });

  it("adds a card that is not in the listed snapshot yet", () => {
    const next = mergeWorkspaceApps(
      [],
      [message("m1", "2026-08-02T00:00:00.000Z", "Notes")],
    );
    expect(next).toEqual([
      {
        id: "a1",
        templateId: "docs",
        title: "Notes",
        createdAt: "2026-08-02T00:00:00.000Z",
      },
    ]);
  });
});
