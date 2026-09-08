import { Link } from "@tanstack/react-router";
import { SiteChrome } from "./SiteChrome";
import { startUrl } from "../lib/app-url";

export function NotFoundPage() {
  return (
    <SiteChrome startUrl={startUrl()}>
      <main>
        <section className="hero">
          <p className="kicker">404</p>
          <h1>That page is not here.</h1>
          <p className="lede">
            Try integrations or use cases, or start a Bot.
          </p>
          <div className="row">
            <Link className="btn" to="/integrations">
              Integrations
            </Link>
            <Link className="btn ghost" to="/use-cases">
              Use cases
            </Link>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
