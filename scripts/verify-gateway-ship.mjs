import { readFileSync } from "node:fs";
import { loadGatewayConfig } from "../packages/adapters/src/gateway.ts";
import { createGatewayStreamFn, resolvePiAiModel } from "../packages/adapters/src/pi-ai-stream.ts";
import { runPiTurn } from "../packages/adapters/src/pi-turn.ts";
import { HOSTED_STARTER_MODEL } from "../packages/contracts/src/models.ts";

const gwVarsPath = "/Users/muhajir/dev/freelance/grox-gateway/.dev.vars";
const gwVars = Object.fromEntries(
  readFileSync(gwVarsPath, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const gatewayUrl = "https://gateway.groxbot.com";
{
  const health = await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(8000) });
  if (!health.ok) {
    throw new Error(`gateway health ${gatewayUrl} → ${health.status}`);
  }
  console.log(`✓ gateway health ${gatewayUrl} → ${health.status}`);
}

const apiHealth = await fetch("https://api.groxbot.com/health");
console.log(`✓ api health → ${apiHealth.status}`, await apiHealth.json());

const secret = gwVars.GATEWAY_SECRET;
if (!secret) throw new Error("GATEWAY_SECRET missing in grox-gateway .dev.vars");

const blocked = await fetch(`${gatewayUrl}/v1/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
    "X-Grox-Workspace-Id": "no-polar-access-test",
  },
  body: JSON.stringify({
    model: HOSTED_STARTER_MODEL,
    messages: [{ role: "user", content: "hi" }],
    stream: false,
    max_tokens: 5,
  }),
});
console.log(
  blocked.status === 403
    ? "✓ entitlement blocks workspace without access → 403"
    : `✗ expected 403 for unknown workspace, got ${blocked.status}`,
);

const env = {
  GROX_GATEWAY_URL: gatewayUrl,
  GROX_GATEWAY_SECRET: secret,
};
const config = loadGatewayConfig(env);
const model = resolvePiAiModel(config, HOSTED_STARTER_MODEL);
console.log(`✓ Pi model baseUrl → ${model.baseUrl}`);
console.log(`✓ Pi model id → ${model.id}`);

const streamFn = createGatewayStreamFn(config, {
  workspaceId: "dev-workspace",
  botId: "verify-bot",
});
const result = await runPiTurn({
  systemPrompt: "Reply briefly.",
  messages: [{ role: "user", content: "Say verify-ok" }],
  model,
  streamFn,
});
const piOk =
  result.stopReason === "stop" && (result.text || "").toLowerCase().includes("verify");
console.log(
  piOk
    ? `✓ Pi turn via grox-gateway → stop, text: ${result.text?.slice(0, 80)}`
    : `✗ Pi turn failed stopReason=${result.stopReason} error=${result.errorMessage} text=${result.text}`,
);

const streamRes = await fetch(`${gatewayUrl}/v1/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
    "X-Grox-Workspace-Id": "dev-workspace",
  },
  body: JSON.stringify({
    model: "workers-ai/@cf/zai-org/glm-5.3-flash",
    messages: [{ role: "user", content: "Say stream-verify" }],
    stream: true,
    max_tokens: 30,
  }),
});
let streamOk = streamRes.ok;
let streamText = "";
if (streamOk && streamRes.body) {
  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  for (let i = 0; i < 12; i++) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        streamText +=
          parsed.choices?.[0]?.delta?.content ||
          parsed.choices?.[0]?.message?.content ||
          "";
      } catch {
        // ignore
      }
    }
  }
  reader.cancel().catch(() => {});
}
console.log(
  streamOk
    ? `✓ gateway SSE stream → ${streamRes.status}, sample: ${streamText.slice(0, 60) || "(reasoning-only chunk)"}`
    : `✗ gateway SSE stream → ${streamRes.status}`,
);

if (!piOk || !streamOk || blocked.status !== 403) {
  process.exit(1);
}
console.log("\nAll gateway ship checks passed.");
