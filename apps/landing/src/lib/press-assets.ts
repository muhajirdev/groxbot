import { mascotMarkElements, mascotMarkSvg } from "@groxbot/mascot/svg";
import {
  GROXBOT_OG_ALT,
  GROXBOT_OG_HEIGHT,
  GROXBOT_OG_WIDTH,
  PRESS_ASSETS,
} from "@groxbot/seo";

/** Bump when the mark geometry changes so browsers drop stale /press/*.svg. */
export const PRESS_ASSET_VERSION = "slit-2026-08-17";

const FONT = "'Source Sans 3', 'Segoe UI', system-ui, sans-serif";

function framedMark(bg: string, paintId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img">
  <title>Groxbot</title>
  <rect width="128" height="128" rx="28" fill="${bg}" />
  <g transform="translate(14 14)">${mascotMarkElements({ paintId, name: "Groxbot" })}</g>
</svg>
`;
}

function lockup(theme: "dark" | "light"): string {
  const ink = theme === "dark" ? "#f4f4f4" : "#171614";
  const bg = theme === "dark" ? "#000000" : "#f4f4f4";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 128" role="img">
  <title>Groxbot</title>
  <rect width="460" height="128" rx="28" fill="${bg}" />
  <g transform="translate(22 22) scale(0.84)">${mascotMarkElements({ paintId: `lockup-${theme}`, name: "Groxbot" })}</g>
  <text x="128" y="78" fill="${ink}" font-size="42" font-weight="600" font-family="${FONT}">Groxbot</text>
</svg>
`;
}

export function iconTileSvg(bg = "#000000"): string {
  return framedMark(bg, "groxbot-icon-tile");
}

export function ogCardSvg(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${GROXBOT_OG_WIDTH}" height="${GROXBOT_OG_HEIGHT}" viewBox="0 0 ${GROXBOT_OG_WIDTH} ${GROXBOT_OG_HEIGHT}" role="img">
  <title>${GROXBOT_OG_ALT}</title>
  <rect width="${GROXBOT_OG_WIDTH}" height="${GROXBOT_OG_HEIGHT}" fill="#000000" />
  <ellipse cx="300" cy="315" rx="300" ry="250" fill="#e45c9a" opacity="0.14" />
  <g transform="translate(108 147) scale(3.36)">${mascotMarkElements({ paintId: "og-mark", name: "Groxbot" })}</g>
  <text x="520" y="262" fill="#f4f4f4" font-size="76" font-weight="600" font-family="${FONT}">Groxbot</text>
  <text x="520" y="332" fill="#e45c9a" font-size="34" font-weight="600" font-family="${FONT}">AI is better together</text>
  <text x="520" y="386" fill="#8a8a8a" font-size="24" font-weight="400" font-family="${FONT}">Like Grok Bot, for the team.</text>
  <rect x="0" y="622" width="${GROXBOT_OG_WIDTH}" height="8" fill="#e45c9a" />
</svg>
`;
}

const BODIES: Record<string, string> = {
  "groxbot-mark.svg": mascotMarkSvg({
    name: "Groxbot",
    paintId: "groxbot-mark",
  }),
  "groxbot-mark-dark.svg": framedMark("#000000", "groxbot-mark-dark"),
  "groxbot-mark-light.svg": framedMark("#f4f4f4", "groxbot-mark-light"),
  "groxbot-lockup-dark.svg": lockup("dark"),
  "groxbot-lockup-light.svg": lockup("light"),
  "groxbot-og.svg": ogCardSvg(),
};

export function pressAssetHref(file: string): string {
  return `/press/${file}?v=${PRESS_ASSET_VERSION}`;
}

export function lookupPressAsset(file: string):
  | {
      filename: string;
      contentType: string;
      body: string;
    }
  | undefined {
  const body = BODIES[file];
  if (!body) return undefined;
  return {
    filename: file,
    contentType: "image/svg+xml; charset=utf-8",
    body,
  };
}

export function svgAssetResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400, must-revalidate",
      "content-disposition": `inline; filename="${filename}"`,
    },
  });
}

export function pressAssetFiles(): string[] {
  return PRESS_ASSETS.map((asset) => asset.file);
}
