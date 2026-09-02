import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IconContext } from "@phosphor-icons/react";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { RouterProvider } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { installViewTransitionGuard } from "./lib/gate-transition";
import "./lib/think-persist";
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
    <IconContext.Provider value={{ size: 16, weight: "regular" }}>
      <HotkeysProvider
        defaultOptions={{
          hotkey: { preventDefault: true },
        }}
      >
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </HotkeysProvider>
    </IconContext.Provider>
  </StrictMode>,
);
