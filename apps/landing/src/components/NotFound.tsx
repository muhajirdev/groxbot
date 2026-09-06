import { Link } from "@tanstack/react-router";
import { appAccessUrl } from "../lib/app-url";
import { SiteChrome } from "./SiteChrome";

export function NotFoundPage() {
  return (
    <SiteChrome startUrl={appAccessUrl()}>
      <main>
        <section className="hero">
          <p className="kicker">404</p>
          <h1>That page is not here.</h1>
          <p className="lede">Try integrations or use cases, or start a Bot.</p>
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
