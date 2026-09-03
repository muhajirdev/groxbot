import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { gitRevision } from "./vite-revision";

const root = path.dirname(fileURLToPath(import.meta.url));

const api = "http://127.0.0.1:3100";

export default defineConfig({
  define: {
    "import.meta.env.VITE_GIT_SHA": JSON.stringify(gitRevision()),
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      quoteStyle: "double",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
    },
  },
  server: {
    // Fallback for leftover relative URLs and old 5173 OAuth callbacks.
    proxy: {
      "/api": api,
      "/health": api,
      "/avatars": api,
      "/agents": {
        target: api,
        ws: true,
        timeout: 0,
        proxyTimeout: 0,
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            const code = (err as NodeJS.ErrnoException).code;
            if (code === "EPIPE" || code === "ECONNRESET" || code === "ECONNREFUSED") {
              return;
            }
            if (
              res &&
              "writeHead" in res &&
              typeof res.writeHead === "function" &&
              !res.headersSent
            ) {
              res.writeHead(502);
              res.end();
            }
          });
        },
      },
      "/apps": {
        target: api,
        ws: true,
      },
      "/rpc": {
        target: api,
        timeout: 0,
        proxyTimeout: 0,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            const type = String(proxyRes.headers["content-type"] ?? "");
            if (
              type.includes("text/event-stream") ||
              type.includes("application/octet-stream")
            ) {
              proxyRes.headers["cache-control"] = "no-cache, no-transform";
              proxyRes.headers["x-accel-buffering"] = "no";
            }
          });
        },
      },
    },
  },
});
