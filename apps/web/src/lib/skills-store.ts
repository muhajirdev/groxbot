import {
  SKILLS_STORE_CATALOG,
  filterSkillsStore,
  type SkillsStoreListing,
  type SkillsStoreSearch,
} from "@groxbot/contracts";
import { useEffect, useState } from "react";
import { client } from "./rpc";

/** Visible store cards for the current search + category (curated only). */
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

export const SKILLS_STORE_LIVE_MIN = 2;
export const SKILLS_STORE_SEARCH_DEBOUNCE_MS = 280;

/**
 * Featured seed while the query is short; live directory search after debounce.
 * Category chips apply only to the featured browse.
 */
export function useSkillsStoreSearch(input: {
  open: boolean;
  query: string;
  category: string | null;
  featuredOnly?: boolean;
  featuredIds?: ReadonlySet<string>;
}): {
  skills: SkillsStoreListing[];
  source: SkillsStoreSearch["source"];
  loading: boolean;
} {
  const [skills, setSkills] = useState<SkillsStoreListing[]>(() =>
    skillsStoreCards({ query: "", category: null }),
  );
  const [source, setSource] =
    useState<SkillsStoreSearch["source"]>("curated");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!input.open) return;
    let cancelled = false;
    const q = input.query.trim();

    if (q.length < SKILLS_STORE_LIVE_MIN) {
      let next = skillsStoreCards({
        query: q,
        category: input.featuredOnly ? null : input.category,
      });
      if (input.featuredOnly && input.featuredIds) {
        next = next.filter((row) => input.featuredIds!.has(row.id));
      }
      setSkills(next);
      setSource("curated");
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      void client.knowledge
        .searchSkills({ query: q, limit: 20 })
        .then((result) => {
          if (cancelled) return;
          setSkills(result.skills);
          setSource(result.source);
        })
        .catch(() => {
          if (cancelled) return;
          setSkills(skillsStoreCards({ query: q, category: null }));
          setSource("curated");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SKILLS_STORE_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    input.open,
    input.query,
    input.category,
    input.featuredOnly,
    input.featuredIds,
  ]);

  return { skills, source, loading };
}
