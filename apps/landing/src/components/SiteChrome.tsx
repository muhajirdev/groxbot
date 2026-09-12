import { MascotMark } from "@groxbot/mascot";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  FOOTER_BLURB,
  SOURCE_REPO,
  START_CTA,
} from "../lib/copy";
import { SupportChatLink } from "./SupportChat";

export function navScrolled(scrollY: number) {
  return scrollY > 24;
}

export function SiteHeader(props: { startUrl: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sync = () => setScrolled(navScrolled(window.scrollY));
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return (
    <header className={scrolled ? "nav is-scrolled" : "nav"}>
      <Link className="brand" to="/" aria-label="Whip Computer home">
        <MascotMark name="Groxbot" color="#e45c9a" shape="circle" size="sm" />
        <span className="brand-name">
          <em>Whip</em> Computer
        </span>
      </Link>
      <nav className="nav-links" aria-label="Site">
        <Link
          className="nav-hide-sm"
          to="/use-cases"
          activeProps={{ className: "on" }}
        >
          Use cases
        </Link>
        <Link
          className="nav-hide-sm"
          to="/templates"
          activeProps={{ className: "on" }}
        >
          Templates
        </Link>
        <Link
          className="nav-hide-sm"
          to="/pricing"
          activeProps={{ className: "on" }}
        >
          Pricing
        </Link>
        <Link
          className="nav-hide-sm"
          to="/integrations"
          activeProps={{ className: "on" }}
        >
          Integrations
        </Link>
        <a
          className="nav-hide-xs"
          href={SOURCE_REPO}
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <a className="btn" href={props.startUrl}>
          {START_CTA}
        </a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <span>{FOOTER_BLURB}</span>
      <nav className="foot-links" aria-label="Footer">
        <Link to="/integrations">Integrations</Link>
        <Link to="/use-cases">Use cases</Link>
        <Link to="/templates">Templates</Link>
        <Link to="/pricing">Pricing</Link>
        <Link to="/enterprise">Enterprise</Link>
        <Link to="/compare">Compare</Link>
        <Link to="/press">Press</Link>
        <Link to="/changelog">Changelog</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <a href={SOURCE_REPO} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <SupportChatLink />
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>
        <Link to="/download">Download Mac app</Link>
        <span className="foot-soon">
          App Store
          <span className="foot-soon-label">Coming soon</span>
        </span>
      </nav>
    </footer>
  );
}

export function SiteChrome(props: { startUrl: string; children: ReactNode }) {
  return (
    <div className="page">
      <SiteHeader startUrl={props.startUrl} />
      {props.children}
      <SiteFooter />
    </div>
  );
}

export function Breadcrumbs(props: {
  items: Array<{ label: string; to?: string }>;
}) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {props.items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 ? <span className="crumb-sep">/</span> : null}
          {item.to ? (
            <a href={item.to}>{item.label}</a>
          ) : (
            <span>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
