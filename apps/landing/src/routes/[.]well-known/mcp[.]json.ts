import { createFileRoute } from "@tanstack/react-router";
import { discoveryResponse } from "../../lib/discovery";

// Folder is `[.]well-known` because TanStack Router skips directories that start with `.`.
export const Route = createFileRoute("/.well-known/mcp.json")({
  server: {
    handlers: {
      GET: ({ request }) => discoveryResponse("/.well-known/mcp.json", request),
    },
  },
});
