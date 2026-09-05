import {
  GROXBOT_APPLE_TOUCH_ICON_PATH,
  GROXBOT_FAVICON_PATH,
  GROXBOT_ICON_PATH,
  GROXBOT_THEME_COLOR,
  jsonBody,
} from "@groxbot/seo";
import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "../lib/site";

export const Route = createFileRoute("/site.webmanifest")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          jsonBody({
            name: SITE_NAME,
            short_name: SITE_NAME,
            description: DEFAULT_DESCRIPTION,
            start_url: "/",
            display: "browser",
            background_color: GROXBOT_THEME_COLOR,
            theme_color: GROXBOT_THEME_COLOR,
            icons: [
              {
                src: GROXBOT_FAVICON_PATH,
                type: "image/svg+xml",
                sizes: "any",
                purpose: "any",
              },
              {
                src: GROXBOT_APPLE_TOUCH_ICON_PATH,
                type: "image/png",
                sizes: "180x180",
                purpose: "any",
              },
              {
                src: GROXBOT_ICON_PATH,
                type: "image/png",
                sizes: "512x512",
                purpose: "any",
              },
            ],
          }),
          {
            headers: {
              "content-type": "application/manifest+json; charset=utf-8",
              "cache-control": "public, max-age=86400",
            },
          },
        ),
    },
  },
});
