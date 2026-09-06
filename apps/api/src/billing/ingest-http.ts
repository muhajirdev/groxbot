import type { HostedUsageIngestInput } from "@groxbot/adapter-kit";

/** RoomActor → Worker billing ingest without bundling Polar in the DO. */
export async function postHostedUsageIngest(
  apiUrl: string,
  authSecret: string,
  input: HostedUsageIngestInput,
): Promise<void> {
  const base = apiUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/internal/billing/ingest-usage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${authSecret}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `billing ingest failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }
}
