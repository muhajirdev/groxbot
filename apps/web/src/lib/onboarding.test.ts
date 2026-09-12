import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  defaultWorkspaceName,
  GROXBOT_DEMO_URL,
  onboardingFirstName,
  workspaceNeedsOnboarding,
} from "./onboarding";

const root = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(root, "../styles.css"), "utf8");
const dialog = readFileSync(
  join(root, "../components/OnboardingDialog.tsx"),
  "utf8",
);

describe("GROXBOT_DEMO_URL", () => {
  it("points at the founder Cal booking", () => {
    expect(GROXBOT_DEMO_URL).toBe("https://cal.com/muhajirdev/groxbot-demo");
  });
});

describe("defaultWorkspaceName", () => {
  it("uses a real name", () => {
    expect(
      defaultWorkspaceName({ name: "Muhajir", email: "muhajir@example.com" }),
    ).toBe("Muhajir");
  });

  it("does not use the login email as the office name", () => {
    expect(
      defaultWorkspaceName({
        name: "muhajir@example.com",
        email: "muhajir@example.com",
      }),
    ).toBe("Workspace");
    expect(defaultWorkspaceName({ name: "", email: "a@b.com" })).toBe(
      "Workspace",
    );
    expect(defaultWorkspaceName(null)).toBe("Workspace");
  });
});

describe("onboardingFirstName", () => {
  it("uses the first word of a real name", () => {
    expect(
      onboardingFirstName({ name: "Muhammad Ali", email: "a@b.com" }),
    ).toBe("Muhammad");
  });

  it("does not greet with the login email", () => {
    expect(
      onboardingFirstName({
        name: "muhajir@example.com",
        email: "muhajir@example.com",
      }),
    ).toBeNull();
    expect(onboardingFirstName({ name: "", email: "a@b.com" })).toBeNull();
  });
});

describe("founder letter chrome", () => {
  it("waits on the continue button until plan state is known", () => {
    expect(dialog).toMatch(/continueWaiting/);
    expect(css).toMatch(/\.onboard-go\.is-waiting::after/);
    expect(css).toMatch(/@keyframes onboard-spin/);
  });

  it("scrolls the note instead of clipping it on a short screen", () => {
    expect(dialog).toMatch(/onboard-dialog[^"\n]*overflow-auto/);
    expect(dialog).not.toMatch(/onboard-dialog[^"\n]*overflow-hidden/);
    expect(css).toMatch(/\.onboard-head\s*\{[^}]*position:\s*sticky/s);
  });

  it("keeps the founder photo from eating the letter", () => {
    expect(dialog).toMatch(/onboard-from-meta/);
    expect(css).toMatch(
      /\.onboard-from\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center/s,
    );
    expect(css).toMatch(/grid-template-columns:\s*96px minmax\(0,\s*1fr\)/);
    expect(css).not.toMatch(/grid-template-columns:\s*180px/);
    expect(css).toMatch(/\.onboard-from-photo\s*\{[^}]*width:\s*40px/s);
    expect(css).not.toMatch(/\.onboard-from-photo\s*\{[^}]*width:\s*88px/s);
  });
});

describe("workspaceNeedsOnboarding", () => {
  it("is true for an empty office", () => {
    expect(workspaceNeedsOnboarding([])).toBe(true);
  });

  it("ignores archived teammates", () => {
    expect(workspaceNeedsOnboarding([{ archivedAt: "2026-09-01" }])).toBe(true);
    expect(
      workspaceNeedsOnboarding([
        { archivedAt: null },
        { archivedAt: "2026-09-01" },
      ]),
    ).toBe(false);
  });
});

describe("org onboarding", () => {
  const org = readFileSync(
    join(root, "../components/OnboardingOrg.tsx"),
    "utf8",
  );
  const enter = readFileSync(join(root, "./enter-office.ts"), "utf8");
  const page = readFileSync(
    join(root, "../routes/_authed/onboarding.tsx"),
    "utf8",
  );

  it("asks for a team name in Groxbot voice, not Paperclip copy", () => {
    expect(org).toMatch(/What do people call this team\?/);
    expect(org).toMatch(/teammates will recognize/);
    expect(org).not.toMatch(/Paperclip/);
    expect(org).toMatch(/placeholder="e.g. Northwind Labs"/);
  });

  it("adds an optional goal step they can skip", () => {
    expect(org).toMatch(/What are you building\?/);
    expect(org).toMatch(/>\s*Skip\s*</);
    expect(org).toMatch(/Who's the team\?/);
    expect(page).toMatch(/goal: input\.goal\.trim\(\) \|\| undefined/);
    expect(page).toMatch(/team: input\.team\.trim\(\) \|\| undefined/);
  });

  it("does not auto-create a nameless office", () => {
    expect(enter).not.toMatch(/workspaces\.create/);
    expect(enter).toMatch(/Name this team to open the office/);
    expect(page).toMatch(/workspaces\.create/);
    expect(page).toMatch(/OnboardingOrg/);
  });
});
