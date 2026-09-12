import { getUseCaseCategory, type UseCaseCategoryId } from "../data/use-cases";
import { getIntegration } from "./integrations";

export type JobIcon = "clock" | "knowledge" | "site" | "mail";

export type JobToken =
  | { kind: "text"; text: string }
  | { kind: "bot" }
  | { kind: "app"; slug: string }
  | { kind: "icon"; icon: JobIcon; text: string }
  | { kind: "literal"; text: string };

export type HomeJob = {
  id: string;
  department: UseCaseCategoryId;
  useCaseSlug: string;
  tokens: JobToken[];
};

/** Ranked by the aha — user’s first sentences, then the rest of the jobs. */
export const HOME_JOBS: HomeJob[] = [
  {
    id: "drive-instagram",
    department: "marketing",
    useCaseSlug: "social-scheduling",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "takes photos from" },
      { kind: "app", slug: "googledrive" },
      { kind: "text", text: "and uploads to" },
      { kind: "app", slug: "instagram" },
    ],
  },
  {
    id: "reddit-digest",
    department: "marketing",
    useCaseSlug: "brand-monitoring",
    tokens: [
      { kind: "bot" },
      { kind: "icon", icon: "clock", text: "every day at 8am" },
      { kind: "text", text: "emails" },
      { kind: "literal", text: "you@company.com" },
      { kind: "text", text: "what people say on" },
      { kind: "app", slug: "reddit" },
      { kind: "text", text: "about" },
      { kind: "literal", text: "z" },
    ],
  },
  {
    id: "gmail-knowledge",
    department: "operations",
    useCaseSlug: "inbox-triage",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "updates my draft in" },
      { kind: "app", slug: "gmail" },
      { kind: "text", text: "from the new policy in the" },
      { kind: "icon", icon: "knowledge", text: "knowledge base" },
    ],
  },
  {
    id: "site-privacy",
    department: "operations",
    useCaseSlug: "seo-content-refresh",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "updates the privacy policy on my" },
      { kind: "icon", icon: "site", text: "website" },
      { kind: "text", text: "from the new" },
      { kind: "icon", icon: "knowledge", text: "knowledge base" },
    ],
  },
  {
    id: "linkedin-hold",
    department: "sales",
    useCaseSlug: "sales-outbound",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "drafts a teardown for" },
      { kind: "app", slug: "linkedin" },
      { kind: "text", text: "and holds it for you" },
    ],
  },
  {
    id: "meeting-prep",
    department: "sales",
    useCaseSlug: "meeting-prep",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "preps tomorrow from" },
      { kind: "app", slug: "googlecalendar" },
      { kind: "text", text: "and" },
      { kind: "app", slug: "hubspot" },
    ],
  },
  {
    id: "typefully-week",
    department: "marketing",
    useCaseSlug: "social-scheduling",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "fills" },
      { kind: "app", slug: "typefully" },
      { kind: "text", text: "from a brief in" },
      { kind: "app", slug: "googledrive" },
    ],
  },
  {
    id: "linear-slack",
    department: "engineering",
    useCaseSlug: "bug-reproduction",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "opens a" },
      { kind: "app", slug: "linear" },
      { kind: "text", text: "ticket from a" },
      { kind: "app", slug: "slack" },
      { kind: "text", text: "thread" },
    ],
  },
  {
    id: "invoice-drive",
    department: "operations",
    useCaseSlug: "invoice-processing",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "reads the invoice in" },
      { kind: "app", slug: "googledrive" },
      { kind: "text", text: "and drafts" },
      { kind: "app", slug: "gmail" },
    ],
  },
  {
    id: "founder-digest",
    department: "founder",
    useCaseSlug: "chief-of-staff",
    tokens: [
      { kind: "bot" },
      { kind: "icon", icon: "clock", text: "Monday 8am" },
      { kind: "text", text: "posts the week in" },
      { kind: "app", slug: "slack" },
      { kind: "text", text: "from" },
      { kind: "app", slug: "notion" },
    ],
  },
  {
    id: "zendesk-knowledge",
    department: "support",
    useCaseSlug: "support-triage",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "drafts a" },
      { kind: "app", slug: "zendesk" },
      { kind: "text", text: "reply from the" },
      { kind: "icon", icon: "knowledge", text: "knowledge base" },
    ],
  },
  {
    id: "webflow-ahrefs",
    department: "seo",
    useCaseSlug: "seo-content-refresh",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "refreshes a" },
      { kind: "app", slug: "webflow" },
      { kind: "text", text: "page from" },
      { kind: "app", slug: "ahrefs" },
    ],
  },
  {
    id: "stripe-sheets",
    department: "data",
    useCaseSlug: "founder-analytics",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "writes" },
      { kind: "app", slug: "stripe" },
      { kind: "text", text: "into" },
      { kind: "app", slug: "googlesheets" },
    ],
  },
  {
    id: "gong-crm",
    department: "sales",
    useCaseSlug: "call-analysis",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "files a" },
      { kind: "app", slug: "gong" },
      { kind: "text", text: "call into" },
      { kind: "app", slug: "hubspot" },
    ],
  },
  {
    id: "twitter-notion",
    department: "marketing",
    useCaseSlug: "competitor-analysis",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "drops a" },
      { kind: "app", slug: "twitter" },
      { kind: "text", text: "teardown into" },
      { kind: "app", slug: "notion" },
    ],
  },
  {
    id: "github-linear",
    department: "engineering",
    useCaseSlug: "shipping-updates",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "writes release notes from" },
      { kind: "app", slug: "github" },
      { kind: "text", text: "into" },
      { kind: "app", slug: "linear" },
    ],
  },
  {
    id: "calendar-gmail",
    department: "operations",
    useCaseSlug: "meeting-prep",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "holds time on" },
      { kind: "app", slug: "googlecalendar" },
      { kind: "text", text: "after a" },
      { kind: "app", slug: "gmail" },
      { kind: "text", text: "thread" },
    ],
  },
  {
    id: "apollo-linkedin",
    department: "sales",
    useCaseSlug: "lead-generation",
    tokens: [
      { kind: "bot" },
      { kind: "text", text: "builds a list in" },
      { kind: "app", slug: "apollo" },
      { kind: "text", text: "and drafts" },
      { kind: "app", slug: "linkedin" },
    ],
  },
];

export function jobDepartmentLabel(id: UseCaseCategoryId): string {
  return getUseCaseCategory(id)?.label ?? id;
}

export function jobApp(slug: string): { name: string; logo: string } {
  const item = getIntegration(slug);
  return {
    name: item?.name ?? slug,
    logo: item?.logo ?? `https://logos.composio.dev/api/${slug}`,
  };
}

export function homeJobMarquee(): {
  rows: [HomeJob[], HomeJob[]];
} {
  const mid = Math.ceil(HOME_JOBS.length / 2);
  return {
    rows: [HOME_JOBS.slice(0, mid), HOME_JOBS.slice(mid)],
  };
}
