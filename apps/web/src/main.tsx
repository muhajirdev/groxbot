import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { RouterProvider } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { installViewTransitionGuard } from "./lib/gate-transition";
import "./styles.css";
import "./lib/office-persist";
import { router } from "./router";

installViewTransitionGuard();

if (navigator.userAgent.includes("Electron")) {
  document.documentElement.classList.add("electron");
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <HotkeysProvider
      defaultOptions={{
        hotkey: { preventDefault: true },
      }}
    >
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </HotkeysProvider>
  </StrictMode>,
);
