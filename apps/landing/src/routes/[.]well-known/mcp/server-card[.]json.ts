import { createFileRoute } from "@tanstack/react-router";
import { discoveryResponse } from "../../../lib/discovery";

export const Route = createFileRoute("/.well-known/mcp/server-card.json")({
  server: {
    handlers: {
      GET: ({ request }) =>
        discoveryResponse("/.well-known/mcp/server-card.json", request),
    },
  },
});
