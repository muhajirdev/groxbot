import { createFileRoute } from "@tanstack/react-router";
import { discoveryResponse } from "../../lib/discovery";

export const Route = createFileRoute("/.well-known/api-catalog")({
  server: {
    handlers: {
      GET: ({ request }) =>
        discoveryResponse("/.well-known/api-catalog", request),
    },
  },
});
