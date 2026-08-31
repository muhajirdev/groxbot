import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const api = "http://127.0.0.1:3100";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      quoteStyle: "double",
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      "/api": api,
      "/health": api,
      "/agents": {
        target: api,
        ws: true,
        timeout: 0,
        proxyTimeout: 0,
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
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
