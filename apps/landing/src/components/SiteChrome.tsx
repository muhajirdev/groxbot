import { MascotMark } from "@groxbot/mascot";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FOOTER_BLURB, MAC_DOWNLOAD_URL, SOURCE_REPO, CONTACT_EMAIL, CONTACT_MAILTO } from "../lib/copy";

export function SiteHeader(props: { startUrl: string }) {
  return (
    <header className="nav">
      <Link className="brand" to="/" aria-label="Groxbot home">
        <MascotMark name="Groxbot" color="#e45c9a" shape="circle" size="sm" />
        Groxbot
      </Link>
      <nav className="nav-links" aria-label="Site">
        <Link className="nav-hide-sm" to="/integrations">
          Integrations
        </Link>
        <Link className="nav-hide-sm" to="/use-cases">
          Use cases
        </Link>
        <Link className="nav-hide-sm" to="/compare">
          Compare
        </Link>
        <a href={SOURCE_REPO} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={CONTACT_MAILTO}>Email</a>
        <a className="btn" href={props.startUrl}>
          Get started
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
        <Link to="/compare">Compare</Link>
        <Link to="/press">Press</Link>
        <a href={SOURCE_REPO} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>
        <a href={MAC_DOWNLOAD_URL} target="_blank" rel="noreferrer">
          Download Mac app
        </a>
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
