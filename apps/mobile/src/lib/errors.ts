const GENERIC = new Set([
  "Bad Request",
  "Precondition Failed",
  "Unauthorized",
  "Internal Server Error",
]);

export function userFacingError(caught: unknown, fallback: string): string {
  if (caught instanceof Error && caught.message.trim()) {
    const text = caught.message.trim();
    return GENERIC.has(text) ? fallback : humanizeRunError(text);
  }
  if (caught && typeof caught === "object" && "message" in caught) {
    const text = String((caught as { message?: unknown }).message ?? "").trim();
    if (text && !GENERIC.has(text)) return humanizeRunError(text);
  }
  return fallback;
}

export function humanizeRunError(raw: string): string {
  const text = raw.trim().replace(/^(\[flue\]\s*)+/i, "");
  if (/^Agent run was aborted \(submission [^)]+\)\.?$/i.test(text)) {
    return "Stopped.";
  }
  if (/^Agent run failed \(submission [^)]+\)\.?$/i.test(text)) {
    return "The model run failed. Pick another model in Settings.";
  }
  const unknown = text.match(
    /^Unknown model ID "([^"]+)" for provider "([^"]+)"/i,
  );
  if (unknown) {
    return `Model “${unknown[1]}” isn’t available for ${unknown[2]}. Pick another model in Settings.`;
  }
  const missing = text.match(/Provider is not configured:\s*(\S+)/i);
  if (missing) {
    return `${missing[1]} isn’t configured. Add a key in Settings.`;
  }
  if (/^error code:\s*\d+/i.test(text)) {
    return "Could not reach this teammate. Try sending again.";
  }
  return text;
}

export function isModelSetupError(message: string): boolean {
  return /add a model key|needs a .+ key/i.test(message);
}

export function composerBannerError(input: {
  inFlight: boolean;
  agentError: string;
  connectionError: string;
  persisted: string;
}): string {
  if (input.inFlight) return "";
  if (input.agentError) return humanizeRunError(input.agentError);
  if (input.connectionError) return humanizeRunError(input.connectionError);
  if (isModelSetupError(input.persisted)) return input.persisted;
  return "";
}
