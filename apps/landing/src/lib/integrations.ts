import { INDIE_INTEGRATIONS } from "../data/indie-integrations";
import { USE_CASES } from "../data/use-cases";
import composioToolkits from "../data/composio-toolkits.json";
import type { ComposioToolkit } from "./composio-catalog";
import {
  categoryFamily,
  firstMessage,
  howABotUses,
  integrationFaqs,
  neverWithoutApproval,
  type CategoryFamily,
} from "./category-copy";
import { slugify } from "./slug";

export type IntegrationKind = "composio" | "computer";

export type Integration = {
  slug: string;
  name: string;
  logo: string;
  description: string;
  category: string;
  categorySlug: string;
  family: CategoryFamily;
  kind: IntegrationKind;
  toolCount: number;
  triggerCount: number;
  sampleTools: string[];
  productUrl?: string;
  founder?: string;
  featured: boolean;
  how: string[];
  neverWithoutApproval: string[];
  firstMessage: string;
  faqs: Array<{ q: string; a: string }>;
};

const FEATURED_COMPOSIO = new Set([
  "gmail",
  "slack",
  "github",
  "notion",
  "googlecalendar",
  "googlesheets",
  "googledocs",
  "googledrive",
  "linear",
  "stripe",
  "twitter",
  "typefully",
  "resend",
  "dub",
  "hubspot",
  "linkedin",
  "instagram",
]);

const catalog = composioToolkits as ComposioToolkit[];

function fromComposio(row: ComposioToolkit): Integration {
  const family = categoryFamily(row.category);
  return {
    slug: row.slug,
    name: row.name,
    logo: row.logo,
    description: row.description,
    category: row.category,
    categorySlug: slugify(row.category),
    family,
    kind: "composio",
    toolCount: row.toolCount,
    triggerCount: row.triggerCount,
    sampleTools: row.sampleTools,
    featured: FEATURED_COMPOSIO.has(row.slug),
    how: howABotUses(row.name, family),
    neverWithoutApproval: neverWithoutApproval(row.name, family),
    firstMessage: firstMessage(row.name, family),
    faqs: integrationFaqs(row.name, family),
  };
}

function fromIndie(
  row: (typeof INDIE_INTEGRATIONS)[number],
): Integration {
  const family = categoryFamily(row.category);
  return {
    slug: row.slug,
    name: row.name,
    logo: `/logos/${row.slug}.png`,
    description: row.description,
    category: row.category,
    categorySlug: slugify(row.category),
    family,
    kind: "computer",
    toolCount: 0,
    triggerCount: 0,
    sampleTools: [],
    productUrl: row.productUrl,
    founder: row.founder,
    featured: row.featured,
    how: row.how,
    neverWithoutApproval: row.neverWithoutApproval,
    firstMessage: row.firstMessage,
    faqs: [
      ...row.faqs,
      {
        q: "Do I need a workflow builder?",
        a: "No. Create a Bot, message it, grant access as needed. There isn't anything to learn — it's like bringing on a coworker.",
      },
    ],
  };
}

const indieList = INDIE_INTEGRATIONS.map(fromIndie);
const indieSlugs = new Set(indieList.map((item) => item.slug));
const composioList = catalog
  .filter((row) => !indieSlugs.has(row.slug))
  .map(fromComposio);

export const INTEGRATIONS: Integration[] = [...indieList, ...composioList];

export function formatIntegrationCount(count = INTEGRATIONS.length): string {
  const rounded = count >= 100 ? Math.floor(count / 100) * 100 : count;
  return `${rounded.toLocaleString("en-US")}+`;
}

const bySlug = new Map(INTEGRATIONS.map((item) => [item.slug, item]));

export function getIntegration(slug: string): Integration | undefined {
  return bySlug.get(slug.toLowerCase());
}

export function featuredIntegrations(): Integration[] {
  return INTEGRATIONS.filter((item) => item.featured);
}

export function computerIntegrations(): Integration[] {
  return INTEGRATIONS.filter((item) => item.kind === "computer");
}

export type IntegrationCategory = {
  name: string;
  slug: string;
  count: number;
};

export function integrationCategories(): IntegrationCategory[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const item of INTEGRATIONS) {
    const current = counts.get(item.categorySlug);
    if (current) {
      current.count += 1;
    } else {
      counts.set(item.categorySlug, { name: item.category, count: 1 });
    }
  }
  return [...counts.entries()]
    .map(([slug, value]) => ({ slug, name: value.name, count: value.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function getCategory(slug: string): IntegrationCategory | undefined {
  return integrationCategories().find((item) => item.slug === slug);
}

export function integrationsInCategory(categorySlug: string): Integration[] {
  return INTEGRATIONS.filter((item) => item.categorySlug === categorySlug);
}

export function relatedIntegrations(item: Integration, limit = 6): Integration[] {
  const same = INTEGRATIONS.filter(
    (other) => other.slug !== item.slug && other.categorySlug === item.categorySlug,
  );
  const extra = INTEGRATIONS.filter(
    (other) =>
      other.slug !== item.slug &&
      other.family === item.family &&
      other.categorySlug !== item.categorySlug,
  );
  const picked: Integration[] = [];
  for (const candidate of [...same, ...extra]) {
    if (picked.some((row) => row.slug === candidate.slug)) continue;
    picked.push(candidate);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function useCasesForIntegration(item: Integration) {
  const direct = USE_CASES.filter((useCase) =>
    useCase.integrationSlugs.includes(item.slug),
  );
  if (direct.length) return direct;
  return USE_CASES.filter((useCase) =>
    useCase.integrationSlugs.some((slug) => {
      const other = getIntegration(slug);
      return other?.family === item.family;
    }),
  ).slice(0, 3);
}

export function searchIntegrations(query: string): Integration[] {
  const q = query.trim().toLowerCase();
  if (!q) return INTEGRATIONS;
  return INTEGRATIONS.filter((item) => {
    return (
      item.name.toLowerCase().includes(q) ||
      item.slug.includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.founder?.toLowerCase().includes(q) ?? false)
    );
  });
}
