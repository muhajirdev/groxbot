import {
  GROXBOT_APPLE_TOUCH_ICON_PATH,
  GROXBOT_FAVICON_ICO_PATH,
  GROXBOT_FAVICON_PATH,
  GROXBOT_ICON_PATH,
  GROXBOT_OG_ALT,
  GROXBOT_OG_HEIGHT,
  GROXBOT_OG_PATH,
  GROXBOT_OG_TYPE,
  GROXBOT_OG_WIDTH,
  GROXBOT_THEME_COLOR,
} from "@groxbot/seo";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { NotFoundPage } from "../components/NotFound";
import { canonicalUrl, DEFAULT_DESCRIPTION, DEFAULT_TITLE } from "../lib/site";
import appCss from "../styles.css?url";

const ogImage = canonicalUrl(GROXBOT_OG_PATH);

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: GROXBOT_THEME_COLOR },
      { name: "color-scheme", content: "dark" },
      { title: DEFAULT_TITLE },
      { name: "description", content: DEFAULT_DESCRIPTION },
      { property: "og:title", content: DEFAULT_TITLE },
      { property: "og:description", content: DEFAULT_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl("/") },
      { property: "og:site_name", content: "Groxbot" },
      { property: "og:locale", content: "en_US" },
      { property: "og:image", content: ogImage },
      { property: "og:image:type", content: GROXBOT_OG_TYPE },
      { property: "og:image:width", content: String(GROXBOT_OG_WIDTH) },
      { property: "og:image:height", content: String(GROXBOT_OG_HEIGHT) },
      { property: "og:image:alt", content: GROXBOT_OG_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: DEFAULT_TITLE },
      { name: "twitter:description", content: DEFAULT_DESCRIPTION },
      { name: "twitter:image", content: ogImage },
      { name: "twitter:image:alt", content: GROXBOT_OG_ALT },
    ],
    links: [
      {
        rel: "icon",
        href: GROXBOT_FAVICON_ICO_PATH,
        type: "image/x-icon",
        sizes: "16x16 32x32 48x48",
      },
      { rel: "icon", href: GROXBOT_FAVICON_PATH, type: "image/svg+xml" },
      {
        rel: "icon",
        href: GROXBOT_ICON_PATH,
        type: "image/png",
        sizes: "512x512",
      },
      {
        rel: "apple-touch-icon",
        href: GROXBOT_APPLE_TOUCH_ICON_PATH,
        sizes: "180x180",
      },
      {
        rel: "manifest",
        href: "/site.webmanifest",
        type: "application/manifest+json",
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "describedby", href: canonicalUrl("/llms.txt") },
      {
        rel: "alternate",
        href: canonicalUrl("/index.md"),
        type: "text/markdown",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument(props: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}
