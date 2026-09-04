export function matchOfficeSkills(
  query: string,
  skills: readonly { name: string; description: string }[],
): Array<{ name: string; description: string }> {
  const trimmed = query.trim();
  if (!trimmed.startsWith("/")) return [];
  if (/\s/.test(trimmed.slice(1))) return [];
  let needle = trimmed.slice(1).toLowerCase();
  if (!needle || needle === "skill" || needle === "skill:") return [...skills];
  if (needle.startsWith("skill:")) needle = needle.slice("skill:".length);
  if (!needle) return [...skills];
  return skills.filter(
    (skill) =>
      skill.name.includes(needle) ||
      skill.description.toLowerCase().includes(needle),
  );
}

export function insertComposerText(text: string): boolean {
  const el = document.querySelector<HTMLTextAreaElement>(
    "textarea.aui-composer-input",
  );
  if (!el) return false;
  const proto = window.HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  const next = `${el.value}${el.value && !el.value.endsWith(" ") ? " " : ""}${text}`;
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  return true;
}
