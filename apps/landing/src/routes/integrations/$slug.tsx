import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BulletList, FaqList } from "../../components/ContentBits";
import {
  IntegrationGrid,
  IntegrationLogo,
} from "../../components/IntegrationCard";
import { Breadcrumbs, SiteChrome } from "../../components/SiteChrome";
import { startUrl } from "../../lib/app-url";
import {
  getIntegration,
  relatedIntegrations,
  useCasesForIntegration,
} from "../../lib/integrations";
import { integrationJsonLd } from "../../lib/json-ld";
import { seoHead } from "../../lib/site";

export const Route = createFileRoute("/integrations/$slug")({
  loader: ({ params }) => {
    const item = getIntegration(params.slug);
    if (!item) throw notFound();
    return {
      startUrl: startUrl(),
      item,
      related: relatedIntegrations(item),
      useCases: useCasesForIntegration(item),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.item) return {};
    const { item } = loaderData;
    return seoHead({
      title: `${item.name} integration`,
      description: `Groxbot + ${item.name}: ${item.description}`.slice(0, 160),
      path: `/integrations/${item.slug}`,
      jsonLd: integrationJsonLd(item),
    });
  },
  component: IntegrationPage,
});

function IntegrationPage() {
  const { startUrl, item, related, useCases } = Route.useLoaderData();
  const connectorLine =
    item.kind === "composio"
      ? `${item.toolCount} ${item.name} tools` +
        (item.triggerCount ? ` and ${item.triggerCount} triggers` : "") +
        ". Connect under Plugins. The Bot still asks before anything leaves the thread."
      : `The Bot uses a real computer — the ${item.name} dashboard in a browser — then stops for login, 2FA, or publish.`;

  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Integrations", to: "/integrations" },
            { label: item.name },
          ]}
        />
        <section className="hero int-hero">
          <IntegrationLogo item={item} />
          <div>
            <p className="kicker">
              {item.kind === "computer" ? "Computer" : "Plugin"} ·{" "}
              <Link
                to="/integrations/category/$category"
                params={{ category: item.categorySlug }}
              >
                {item.category}
              </Link>
              {item.founder ? ` · ${item.founder}` : null}
            </p>
            <h1>Groxbot + {item.name}</h1>
            <p className="lede">{item.description}</p>
            <div className="row">
              <a className="btn" href={startUrl}>
                Request an invite
              </a>
              {item.productUrl ? (
                <a
                  className="btn ghost"
                  href={item.productUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.name} site
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="band">
          <h2>How a Bot uses {item.name}</h2>
          <p className="lede tight">{connectorLine}</p>
          <BulletList items={item.how} />
          <h3>Never without you</h3>
          <BulletList items={item.neverWithoutApproval} />
        </section>

        <section className="band">
          <h2>First message</h2>
          <p className="prompt">{item.firstMessage}</p>
        </section>

        {item.sampleTools.length ? (
          <section className="band">
            <h2>Tools a Bot can call</h2>
            <p className="lede tight">
              A sample from the {item.name} toolkit. The Bot calls these after
              you connect. Writes that would go live still wait for approval.
            </p>
            <ul className="points">
              {item.sampleTools.map((tool) => (
                <li key={tool}>{tool}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {useCases.length ? (
          <section className="band">
            <h2>Jobs that use {item.name}</h2>
            <ul className="link-list">
              {useCases.map((useCase) => (
                <li key={useCase.slug}>
                  <Link to="/use-cases/$slug" params={{ slug: useCase.slug }}>
                    {useCase.title}
                  </Link>
                  <span className="muted"> — {useCase.lede}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {related.length ? (
          <section className="band">
            <h2>Related integrations</h2>
            <IntegrationGrid items={related} />
          </section>
        ) : null}

        <section id="faq" className="band">
          <h2>FAQ</h2>
          <FaqList items={item.faqs} />
        </section>
      </main>
    </SiteChrome>
  );
}
