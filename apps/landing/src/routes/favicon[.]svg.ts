import { createFileRoute } from "@tanstack/react-router";
import { lookupPressAsset, svgAssetResponse } from "../lib/press-assets";

export const Route = createFileRoute("/favicon.svg")({
  server: {
    handlers: {
      GET: () => {
        const asset = lookupPressAsset("groxbot-mark.svg");
        if (!asset) return new Response("Not found", { status: 404 });
        return svgAssetResponse(asset.body, "favicon.svg");
      },
    },
  },
});
