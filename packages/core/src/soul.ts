/** Frozen office identity — name (and job, if set) plus how this desk works. */
export function composeSoul(base: string, overlay: string): string {
  const identity = base.trim();
  const evolved = overlay.trim();
  if (!evolved) return identity;
  if (!identity) return evolved;
  if (evolved.startsWith(identity)) return evolved;
  return `${identity}\n\n${evolved}`;
}

/**
 * `set_context` replace/append sends the whole soul block. Strip the frozen
 * prefix so we persist only what the teammate grew.
 */
export function soulOverlayFromWrite(base: string, written: string): string {
  const identity = base.trim();
  const next = written.trim();
  if (!next || next === identity) return "";
  if (identity && next.startsWith(identity)) {
    return next.slice(identity.length).trim();
  }
  return next;
}
