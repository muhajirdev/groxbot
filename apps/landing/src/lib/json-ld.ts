import { GROXBOT_EMAIL, GROXBOT_WHAT } from "@groxbot/seo";
import type { ComparePage } from "../data/compare";
import type { UseCase } from "../data/use-cases";
import type { Integration } from "./integrations";
import { canonicalUrl, landingOrigin, SITE_NAME } from "./site";

export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: landingOrigin(),
    email: GROXBOT_EMAIL,
    sameAs: ["https://github.com/muhajirdev/groxbot"],
  };
}

export function softwareJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: landingOrigin(),
    description: `${GROXBOT_WHAT} Self-hostable. No workflow builder.`,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export function breadcrumbJsonLd(
  crumbs: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: canonicalUrl(crumb.path),
    })),
  };
}

export function faqJsonLd(
  faqs: Array<{ q: string; a: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function itemListJsonLd(
  name: string,
  path: string,
  items: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: canonicalUrl(path),
    numberOfItems: items.length,
    itemListElement: items.slice(0, 50).map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: canonicalUrl(item.path),
    })),
  };
}

export function integrationJsonLd(
  item: Integration,
): Record<string, unknown>[] {
  return [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Integrations", path: "/integrations" },
      { name: item.name, path: `/integrations/${item.slug}` },
    ]),
    faqJsonLd(item.faqs),
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${SITE_NAME} ${item.name} integration`,
      url: canonicalUrl(`/integrations/${item.slug}`),
      description: item.description,
    },
  ];
}

export function useCaseJsonLd(item: UseCase): Record<string, unknown>[] {
  return [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Use cases", path: "/use-cases" },
      { name: item.title, path: `/use-cases/${item.slug}` },
    ]),
    faqJsonLd(item.faqs),
  ];
}

export function compareJsonLd(page: ComparePage): Record<string, unknown>[] {
  return [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Compare", path: "/compare" },
      { name: page.title, path: `/compare/${page.slug}` },
    ]),
    faqJsonLd(page.faqs),
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.title,
      url: canonicalUrl(`/compare/${page.slug}`),
      description: page.description,
      about: page.products.map((product) => ({
        "@type": "SoftwareApplication",
        name: product.name,
        description: product.summary,
      })),
    },
  ];
}
