/**
 * Egress for ChatGPT / Codex. Cloudflare Workers are blocked at chatgpt.com;
 * this Fly machine forwards only those two hosts.
 */
import http from "node:http";

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.PROXY_SECRET ?? "";

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const STRIP = new Set(["x-groxbot-codex-proxy", "x-groxbot-target"]);

/** Only Codex/OpenAI request headers. Fly adds X-Forwarded-For = Worker IP; forwarding that re-triggers the WAF. */
const ALLOW = new Set([
  "accept",
  "authorization",
  "chatgpt-account-id",
  "content-encoding",
  "content-type",
  "openai-beta",
  "originator",
  "session-id",
  "user-agent",
  "x-client-request-id",
]);

function isCodexProxyTarget(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname === "auth.openai.com") return true;
    return (
      parsed.hostname === "chatgpt.com" &&
      parsed.pathname.startsWith("/backend-api")
    );
  } catch {
    return false;
  }
}

function headerValue(value) {
  if (value == null) return "";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function collectHeaders(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    const name = key.toLowerCase();
    if (!value || HOP.has(name) || STRIP.has(name) || !ALLOW.has(name)) continue;
    if (name.startsWith("cf-") || name.startsWith("fly-") || name.startsWith("x-forwarded-")) {
      continue;
    }
    headers.set(key, headerValue(value));
  }
  return headers;
}

async function handle(req, res) {
  const url = req.url ?? "/";
  if (req.method === "GET" && (url === "/" || url === "/health")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (!SECRET || headerValue(req.headers["x-groxbot-codex-proxy"]) !== SECRET) {
    res.writeHead(401, { "content-type": "text/plain" });
    res.end("unauthorized");
    return;
  }

  const target = headerValue(req.headers["x-groxbot-target"]);
  if (!isCodexProxyTarget(target)) {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("bad target");
    return;
  }

  const method = req.method ?? "GET";
  let body;
  if (method !== "GET" && method !== "HEAD") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }
  const headers = collectHeaders(req);
  const upstream = await fetch(target, {
    method,
    headers,
    body,
  });
  const parsed = new URL(target);
  console.log(
    JSON.stringify({
      method,
      host: parsed.host,
      path: parsed.pathname,
      status: upstream.status,
      type: upstream.headers.get("content-type") ?? "",
      forwarded: [...headers.keys()],
    }),
  );

  const out = {};
  upstream.headers.forEach((value, key) => {
    if (key === "transfer-encoding") return;
    out[key] = value;
  });
  res.writeHead(upstream.status, out);
  if (!upstream.body) {
    res.end();
    return;
  }
  for await (const chunk of upstream.body) {
    res.write(chunk);
  }
  res.end();
}

const server = http.createServer((req, res) => {
  void handle(req, res).catch((error) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(error instanceof Error ? error.message : "proxy failed");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`codex-proxy listening on ${PORT}`);
});
