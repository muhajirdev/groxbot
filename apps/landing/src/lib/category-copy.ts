export type CategoryFamily =
  | "email"
  | "chat"
  | "crm"
  | "marketing"
  | "analytics"
  | "docs"
  | "code"
  | "support"
  | "payments"
  | "social"
  | "calendar"
  | "files"
  | "ai"
  | "general";

const FAMILY_LABEL: Record<CategoryFamily, string> = {
  email: "email",
  chat: "team chat",
  crm: "CRM",
  marketing: "marketing",
  analytics: "analytics",
  docs: "docs and sheets",
  code: "engineering",
  support: "support",
  payments: "billing",
  social: "social",
  calendar: "calendar",
  files: "files",
  ai: "AI tools",
  general: "this tool",
};

export function categoryFamily(category: string): CategoryFamily {
  const c = category.toLowerCase();
  if (
    c.includes("email") ||
    c.includes("newsletter") ||
    c.includes("drip") ||
    c.includes("transactional")
  ) {
    return "email";
  }
  if (
    c.includes("chat") ||
    c.includes("sms") ||
    c.includes("phone") ||
    c.includes("notification") ||
    c === "communication"
  ) {
    return "chat";
  }
  if (
    c.includes("crm") ||
    c.includes("sales") ||
    c.includes("contact management") ||
    c.includes("fundraising")
  ) {
    return "crm";
  }
  if (
    c.includes("marketing") ||
    c.includes("ads") ||
    c.includes("reviews") ||
    c.includes("ecommerce") ||
    c.includes("e-commerce") ||
    c.includes("commerce")
  ) {
    return "marketing";
  }
  if (
    c.includes("analytics") ||
    c.includes("business intelligence") ||
    c.includes("server monitoring")
  ) {
    return "analytics";
  }
  if (
    c.includes("document") ||
    c.includes("notes") ||
    c.includes("spreadsheet") ||
    c.includes("signature") ||
    c.includes("form")
  ) {
    return "docs";
  }
  if (
    c.includes("developer") ||
    c.includes("database") ||
    c.includes("devops") ||
    c.includes("model context") ||
    c.includes("it operations") ||
    c.includes("app builder")
  ) {
    return "code";
  }
  if (c.includes("support") || c.includes("customer")) {
    return "support";
  }
  if (
    c.includes("payment") ||
    c.includes("accounting") ||
    c.includes("tax") ||
    c.includes("invoice")
  ) {
    return "payments";
  }
  if (c.includes("social")) {
    return "social";
  }
  if (
    c.includes("schedul") ||
    c.includes("calendar") ||
    c.includes("booking") ||
    c.includes("event") ||
    c.includes("webinar") ||
    c.includes("time tracking")
  ) {
    return "calendar";
  }
  if (c.includes("file") || c.includes("storage") || c.includes("content")) {
    return "files";
  }
  if (c.startsWith("ai ") || c.includes("artificial intelligence")) {
    return "ai";
  }
  return "general";
}

export function familyLabel(family: CategoryFamily): string {
  return FAMILY_LABEL[family];
}

export function howABotUses(
  name: string,
  family: CategoryFamily,
): string[] {
  switch (family) {
    case "email":
      return [
        `Read the ${name} threads you name and draft replies in the Bot thread.`,
        "File, label, or summarize mail so you are not hunting the inbox.",
        "Stop before anything is sent. The draft stays a draft until you say so.",
      ];
    case "chat":
      return [
        `Watch the ${name} rooms you name and pull the decisions into one handoff.`,
        "Draft a reply in the Bot thread. Never post to the channel on its own.",
        "Cite the message, not a vibe. If it cannot find the thread, it stops.",
      ];
    case "crm":
      return [
        `Look up the accounts you name in ${name}. Return a short health read.`,
        "Draft a follow-up. Do not create or close records until you approve.",
        "Cite the CRM fields. If a number is missing, it says so.",
      ];
    case "marketing":
      return [
        `Pull campaign numbers from ${name} and cite the source.`,
        "Draft copy or a change list. Never publish or spend without you.",
        "If live ads would change, it stops and asks.",
      ];
    case "analytics":
      return [
        `Query ${name} for the numbers you name. Five bullets, then open questions.`,
        "Cite the property, date range, and metric. No invented charts.",
        "Never change pixels, goals, or production dashboards.",
      ];
    case "docs":
      return [
        `Open the ${name} files you name. Summarize, extract dates, list open questions.`,
        "Propose edits in the thread. Do not overwrite the source until you say so.",
        "If the file is missing, it stops instead of guessing.",
      ];
    case "code":
      return [
        `Read the ${name} project you name. Reproduce, summarize, or draft a patch.`,
        "Never merge, deploy, or change production without approval.",
        "End with steps, expected vs actual, and a minimal fixture when it can.",
      ];
    case "support":
      return [
        `Work the ${name} queue you name. Draft replies from the transcript.`,
        "Never close a ticket or message a customer until you say so.",
        "Flag anything that needs a human: refunds, legal, angry accounts.",
      ];
    case "payments":
      return [
        `Read ${name} for the invoices, payouts, or disputes you name.`,
        "Flag exceptions over policy. Never refund, pay, or submit evidence alone.",
        "Return a table: amount, reason, what to do next.",
      ];
    case "social":
      return [
        `Draft posts for ${name} from the brief. Keep them in the Bot thread.`,
        "Queue is fine. Publish is not — not until you approve.",
        "If a network would go live, it stops.",
      ];
    case "calendar":
      return [
        `Check ${name} for the week you name. List conflicts and open slots.`,
        "Draft holds. Never send invites on its own.",
        "Cite event titles and times. Do not invent meetings.",
      ];
    case "files":
      return [
        `Find the ${name} files you name and bring a summary back to the thread.`,
        "Do not delete, share publicly, or move folders without approval.",
        "If access is missing, it asks instead of widening permissions.",
      ];
    case "ai":
      return [
        `Call ${name} only for the task you named. Paste the result into the thread.`,
        "Treat the output as a draft. You still approve anything that leaves Whip Computer.",
        "Do not chain mystery tools. One job, then stop.",
      ];
    default:
      return [
        `Use ${name} the way you would: open it, do the task, come back with evidence.`,
        "Work stays in the Bot thread. Anything leaving Whip Computer needs your OK.",
        "If it hits a login, 2FA, or a paywall, it stops on the computer for you.",
      ];
  }
}

export function neverWithoutApproval(
  name: string,
  family: CategoryFamily,
): string[] {
  switch (family) {
    case "email":
      return [`Send, forward, or auto-reply from ${name}`, "Delete mail in bulk"];
    case "chat":
      return [`Post into a ${name} channel`, "Invite or kick people"];
    case "crm":
      return ["Create or delete records", "Email the customer from the CRM"];
    case "marketing":
      return ["Publish a campaign", "Change bids, budgets, or live ads"];
    case "analytics":
      return ["Edit production dashboards", "Change tracking or goals"];
    case "docs":
      return ["Overwrite the source file", "Share a doc outside the workspace"];
    case "code":
      return ["Merge, deploy, or delete a repo", "Change production config"];
    case "support":
      return ["Close a ticket", "Issue a refund or credit"];
    case "payments":
      return ["Refund, payout, or charge", "Submit a dispute"];
    case "social":
      return [`Publish to ${name}`, "Change the connected account"];
    case "calendar":
      return ["Send invites", "Cancel someone else's event"];
    case "files":
      return ["Delete or publicly share files", "Widen access"];
    case "ai":
      return ["Spend on a third-party run you did not name", "Post the output anywhere live"];
    default:
      return [
        `Change live ${name} settings`,
        "Message anyone outside the Bot thread",
      ];
  }
}

export function firstMessage(name: string, family: CategoryFamily): string {
  switch (family) {
    case "email":
      return `Pull unread ${name} from the last 24 hours. Draft replies. Do not send.`;
    case "chat":
      return `Summarize the ${name} room I name. Decisions, owners, dates. Do not post.`;
    case "crm":
      return `Look up these accounts in ${name}. Health, last touch, risk. Do not email anyone.`;
    case "marketing":
      return `Pull this week's numbers from ${name}. Cite the source. Do not change campaigns.`;
    case "analytics":
      return `From ${name}, what drove revenue this week? Cite the property. Do not change dashboards.`;
    case "docs":
      return `Open this ${name} file. Five bullets: dates, decisions, open questions. Do not edit it.`;
    case "code":
      return `In ${name}, reproduce this bug. Steps, expected vs actual. Do not change production.`;
    case "support":
      return `Draft replies for the open ${name} tickets I name. Do not send or close.`;
    case "payments":
      return `List ${name} exceptions over policy this week. Do not refund or pay.`;
    case "social":
      return `Draft three posts for ${name} from this brief. Do not publish.`;
    case "calendar":
      return `What does ${name} look like this week? Conflicts only. Do not invite anyone.`;
    case "files":
      return `Find this file in ${name} and summarize it. Do not move or share it.`;
    case "ai":
      return `Use ${name} once for this prompt. Paste the draft here. Do not post it anywhere else.`;
    default:
      return `Use ${name} for this task. Stay in the thread. Stop if you would change anything live.`;
  }
}

export function integrationFaqs(
  name: string,
  family: CategoryFamily,
): Array<{ q: string; a: string }> {
  return [
    {
      q: `Does Whip Computer have a native ${name} integration?`,
      a:
        family === "general"
          ? `Connect ${name} under Plugins when it is listed. If not, the Bot still has a real computer — it can work in ${name} in the browser the way you would, then stop when it needs a login or approval.`
          : `Yes. Connect ${name} under Plugins. The Bot still asks before anything leaves the thread — sending ${familyLabel(family)} included.`,
    },
    {
      q: `Can a Bot change live ${name} data?`,
      a: `Not by default. Whip Computer is talk-first: draft in the thread, grant access when it hits a wall. Live ${name} writes wait for you.`,
    },
    {
      q: "Do I need a workflow builder?",
      a: "No. Create a Bot, message it, grant access as needed. There isn't anything to learn — it's like bringing on a coworker.",
    },
  ];
}
