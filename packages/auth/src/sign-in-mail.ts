export const SIGN_IN_EXPIRES_SEC = 15 * 60;
export const SIGN_IN_OTP_LENGTH = 6;

export function signInMailCopy(input: { url?: string; otp?: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const url = input.url?.trim() ?? "";
  const otp = input.otp?.trim() ?? "";
  const subject = "Sign in to Groxbot";
  const lines = ["Sign in to Groxbot."];
  if (url) lines.push(`Open Groxbot:\n${url}`);
  if (otp) {
    lines.push(url ? `Or enter this code: ${otp}` : `Enter this code: ${otp}`);
  }
  lines.push("This expires in 15 minutes.");
  const html: string[] = ["<p>Sign in to Groxbot.</p>"];
  if (url) {
    html.push(`<p><a href="${escapeHtml(url)}">Open Groxbot</a></p>`);
  }
  if (otp) {
    const label = url ? "Or enter this code" : "Enter this code";
    html.push(`<p>${label}: <strong>${escapeHtml(otp)}</strong></p>`);
  }
  html.push("<p>This expires in 15 minutes.</p>");
  return { subject, text: lines.join("\n\n"), html: html.join("") };
}

export function digitsOfOtp(value: string, length = SIGN_IN_OTP_LENGTH): string {
  return value.replace(/\D/g, "").slice(0, length);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
