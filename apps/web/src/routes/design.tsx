import { createFileRoute } from "@tanstack/react-router";
import { Design } from "../screens/Design";

export const Route = createFileRoute("/design")({
  component: DesignPage,
});

function DesignPage() {
  return <Design />;
}
