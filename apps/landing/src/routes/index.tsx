import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "../components/Landing";
import { startUrl } from "../lib/app-url";
import { FAQS } from "../lib/copy";
import { faqJsonLd, organizationJsonLd, softwareJsonLd } from "../lib/json-ld";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, seoHead } from "../lib/site";

export const Route = createFileRoute("/")({
  loader: () => ({ startUrl: startUrl() }),
  head: () =>
    seoHead({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      path: "/",
      jsonLd: [organizationJsonLd(), softwareJsonLd(), faqJsonLd([...FAQS])],
    }),
  component: Home,
});

function Home() {
  const { startUrl } = Route.useLoaderData();
  return <Landing startUrl={startUrl} />;
}
