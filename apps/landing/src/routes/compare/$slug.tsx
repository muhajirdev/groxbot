import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { FaqList } from "../../components/ContentBits";
import { Breadcrumbs, SiteChrome } from "../../components/SiteChrome";
import {
  type CompareCell,
  getComparePage,
  relatedComparePages,
} from "../../data/compare";
import { appLoginUrl } from "../../lib/app-url";
import { compareJsonLd } from "../../lib/json-ld";
import { seoHead } from "../../lib/site";

export const Route = createFileRoute("/compare/$slug")({
  loader: ({ params }) => {
    const page = getComparePage(params.slug);
    if (!page) throw notFound();
    return {
      startUrl: appLoginUrl(),
      page,
      related: relatedComparePages(page.slug),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.page) return {};
    const { page } = loaderData;
    return seoHead({
      title: page.title,
      description: page.description,
      path: `/compare/${page.slug}`,
      jsonLd: compareJsonLd(page),
    });
  },
  component: CompareSlugPage,
});

function CellValue(props: { value: CompareCell }) {
  if (typeof props.value === "boolean") {
    return props.value ? (
      <span className="compare-yes" title="Yes" aria-label="Yes">
        <span aria-hidden="true">✓</span>
      </span>
    ) : (
      <span className="compare-no" title="No" aria-label="No">
        <span aria-hidden="true">✕</span>
      </span>
    );
  }
  return <span className="compare-text">{props.value}</span>;
}

function CompareSlugPage() {
  const { startUrl, page, related } = Route.useLoaderData();
  const byId = Object.fromEntries(
    page.products.map((product) => [product.id, product]),
  ) as Record<
    (typeof page.products)[number]["id"],
    (typeof page.products)[number]
  >;
  const versusClass =
    page.products.length === 2
      ? "versus versus-2"
      : page.products.length === 4
        ? "versus versus-4"
        : "versus";

  return (
    <SiteChrome startUrl={startUrl}>
      <main>
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Compare", to: "/compare" },
            { label: page.title },
          ]}
        />

        <section className="hero !py-8 sm:!py-12 sm:!pb-10">
          <p className="kicker">Compare</p>
          <h1 className="!my-2 !mb-4">{page.title}</h1>
          <p className="lede !mb-3 !text-xl">{page.lede}</p>
          <p className="thesis !mb-7 max-w-2xl">{page.thesis}</p>
          <div className="row mt-1">
            <a className="btn lg" href={startUrl}>
              Get started
            </a>
            <Link className="btn ghost" to="/use-cases">
              See use cases
            </Link>
          </div>
        </section>

        <section
          className={`${versusClass} !mt-0 !mb-10`}
          aria-label="Product snapshots"
        >
          {page.products.map((product) => (
            <article
              key={product.id}
              className={`versus-col${product.ours ? " ours" : ""}`}
            >
              <p className="kicker">{product.kicker}</p>
              <h2 className="!mb-2.5 !text-[22px]">{product.name}</h2>
              <p>{product.summary}</p>
              <p className="compare-best">
                <span className="kicker">Best for</span>
                {product.bestFor}
              </p>
            </article>
          ))}
        </section>

        <section className="py-2 pb-12" aria-labelledby="matrix-heading">
          <h2 id="matrix-heading">Feature table</h2>
          <p className="lede tight !mb-5">
            Multiplayer and a shared knowledge base are where the office wins.
            Green checks and crosses — no fog.
          </p>
          <div className="compare-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col"> </th>
                  {page.products.map((product) => (
                    <th
                      key={product.id}
                      scope="col"
                      className={product.ours ? "ours" : undefined}
                    >
                      {product.shortName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">
                      {row.label}
                      {row.hint ? (
                        <span className="compare-hint">{row.hint}</span>
                      ) : null}
                    </th>
                    {page.products.map((product) => (
                      <td
                        key={product.id}
                        className={product.ours ? "ours" : undefined}
                      >
                        <CellValue value={row.values[product.id] ?? false} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="py-2 pb-12" aria-labelledby="pick-heading">
          <h2 id="pick-heading">Which should you pick?</h2>
          <p className="lede tight !mb-5">
            Pick by the job, not by stars. These layers can compose — they do
            not all replace each other.
          </p>
          <ol className="compare-picks">
            {page.pickWhen.map((item) => {
              const product = byId[item.productId];
              return (
                <li
                  key={item.productId}
                  className={product.ours ? "ours" : undefined}
                >
                  <p className="kicker">{product.kicker}</p>
                  <h3>{product.name}</h3>
                  <p>{item.when}</p>
                </li>
              );
            })}
          </ol>
        </section>

        {related.length ? (
          <section className="py-2 pb-12" aria-labelledby="more-heading">
            <h2 id="more-heading">More comparisons</h2>
            <p className="lede tight !mb-5">
              Every pairwise vs, plus the full four-way.
            </p>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {related.map((other) => (
                <article key={other.slug} className="card flex flex-col">
                  <p className="kicker">Compare</p>
                  <h3 className="!mb-2 !text-lg">
                    <Link
                      className="no-underline hover:underline"
                      to="/compare/$slug"
                      params={{ slug: other.slug }}
                    >
                      {other.title}
                    </Link>
                  </h3>
                  <p>{other.lede}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section id="faq" className="faq-band !py-6 !pb-4">
          <h2>FAQ</h2>
          <FaqList items={page.faqs} />
        </section>

        <section className="cta">
          <p className="kicker">Multiplayer + shared knowledge</p>
          <h2>Hire the first teammate.</h2>
          <p className="lede tight">
            Name, optional job, how it should work. Open the thread. The first
            message is a real task.
          </p>
          <a className="btn lg" href={startUrl}>
            Get started
          </a>
        </section>
      </main>
    </SiteChrome>
  );
}
