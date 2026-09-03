export const SKILL_IMPORT_PLACEHOLDER = "owner/repo or a GitHub URL";

export function skillImportSummary(result: {
  imported: Array<{ name: string }>;
  skipped: Array<{ name: string; reason: string }>;
}): string {
  if (result.imported.length === 1 && result.skipped.length === 0) {
    return `Imported /${result.imported[0]?.name} into skills/.`;
  }
  if (result.imported.length > 0 && result.skipped.length === 0) {
    return `Imported ${result.imported.length} playbooks into skills/.`;
  }
  if (result.imported.length === 0 && result.skipped.length > 0) {
    const first = result.skipped[0];
    return first?.reason || "Nothing new to import.";
  }
  return `Imported ${result.imported.length}. Skipped ${result.skipped.length}.`;
}
