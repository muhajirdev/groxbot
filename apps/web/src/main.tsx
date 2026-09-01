import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { installViewTransitionGuard } from "./lib/gate-transition";
import { router } from "./router";
import "./styles.css";

installViewTransitionGuard();

if (navigator.userAgent.includes("Electron")) {
  document.documentElement.classList.add("electron");
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  </StrictMode>,
);
