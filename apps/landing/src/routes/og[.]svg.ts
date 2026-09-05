import { createFileRoute } from "@tanstack/react-router";
import { lookupPressAsset, svgAssetResponse } from "../lib/press-assets";

export const Route = createFileRoute("/og.svg")({
  server: {
    handlers: {
      GET: () => {
        const asset = lookupPressAsset("groxbot-og.svg");
        if (!asset) return new Response("Not found", { status: 404 });
        return svgAssetResponse(asset.body, "groxbot-og.svg");
      },
    },
  },
});
