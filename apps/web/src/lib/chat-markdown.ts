/** Allow http(s) and mailto only. Streamdown still runs rehype-harden. */
export function safeMarkdownUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed;
  return null;
}
