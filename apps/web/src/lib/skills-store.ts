import {
  SKILLS_STORE_CATALOG,
  filterSkillsStore,
  type SkillsStoreListing,
} from "@groxbot/contracts";

/** Visible store cards for the current search + category. */
export function skillsStoreCards(input: {
  catalog?: readonly SkillsStoreListing[];
  query: string;
  category: string | null;
}): SkillsStoreListing[] {
  return filterSkillsStore(
    input.catalog ?? SKILLS_STORE_CATALOG,
    input.query,
    input.category,
  );
}

/** Category chip labels: All first, then unique categories in catalog order. */
export function skillsStoreCategories(
  catalog: readonly SkillsStoreListing[] = SKILLS_STORE_CATALOG,
): string[] {
  return ["All", ...new Set(catalog.map((row) => row.category))];
}

export function skillsStoreTrustLabel(
  trust: SkillsStoreListing["trust"],
): string {
  if (trust === "official") return "Official";
  if (trust === "trusted") return "Trusted";
  return "Community";
}
