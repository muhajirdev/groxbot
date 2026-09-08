/** Skills store listings — curated seed + live directory search. Install via `knowledge.importSkill`. */

import * as z from "zod";

export const SkillsStoreTrust = z.enum(["official", "trusted", "community"]);
export type SkillsStoreTrust = z.infer<typeof SkillsStoreTrust>;

export const SkillsStoreListingSchema = z.object({
  id: z.string().min(1).max(240),
  name: z.string().min(1).max(120),
  blurb: z.string().max(200),
  category: z.string().min(1).max(80),
  /** GitHub `owner/repo`, `owner/repo/skill-name`, or GitHub URL for import. */
  source: z.string().min(1).max(500),
  trust: SkillsStoreTrust,
  /** Optional upstream homepage. */
  homepage: z.string().max(500).optional(),
});
export type SkillsStoreListing = z.infer<typeof SkillsStoreListingSchema>;

export const SkillsStoreSearchSchema = z.object({
  skills: z.array(SkillsStoreListingSchema),
  source: z.enum(["curated", "directory"]),
});
export type SkillsStoreSearch = z.infer<typeof SkillsStoreSearchSchema>;

/**
 * Featured seed when search is empty. Longer queries hit the open skills
 * directory under the hood; install still copies from GitHub.
 */
export const SKILLS_STORE_CATALOG: readonly SkillsStoreListing[] = [
  {
    id: "anthropic-pdf",
    name: "PDF",
    blurb: "Read, extract, and fill PDFs with forms and tables.",
    category: "Documents",
    source: "anthropics/skills/pdf",
    trust: "trusted",
    homepage: "https://github.com/anthropics/skills",
  },
  {
    id: "anthropic-docx",
    name: "DOCX",
    blurb: "Create and edit Word documents with tracked changes.",
    category: "Documents",
    source: "anthropics/skills/docx",
    trust: "trusted",
    homepage: "https://github.com/anthropics/skills",
  },
  {
    id: "anthropic-xlsx",
    name: "XLSX",
    blurb: "Build spreadsheets, formulas, and charts in Excel files.",
    category: "Documents",
    source: "anthropics/skills/xlsx",
    trust: "trusted",
    homepage: "https://github.com/anthropics/skills",
  },
  {
    id: "anthropic-pptx",
    name: "PPTX",
    blurb: "Draft and revise PowerPoint decks from an outline.",
    category: "Documents",
    source: "anthropics/skills/pptx",
    trust: "trusted",
    homepage: "https://github.com/anthropics/skills",
  },
  {
    id: "anthropic-frontend-design",
    name: "Frontend design",
    blurb: "Ship distinctive UI — avoid generic AI aesthetics.",
    category: "Engineering",
    source: "anthropics/skills/frontend-design",
    trust: "trusted",
    homepage: "https://github.com/anthropics/skills",
  },
  {
    id: "anthropic-webapp-testing",
    name: "Webapp testing",
    blurb: "Browser QA with Playwright against a running app.",
    category: "Engineering",
    source: "anthropics/skills/webapp-testing",
    trust: "trusted",
    homepage: "https://github.com/anthropics/skills",
  },
  {
    id: "anthropic-mcp-builder",
    name: "MCP builder",
    blurb: "Design and scaffold Model Context Protocol servers.",
    category: "Engineering",
    source: "anthropics/skills/mcp-builder",
    trust: "trusted",
    homepage: "https://github.com/anthropics/skills",
  },
  {
    id: "openai-gh-address-comments",
    name: "GH address comments",
    blurb: "Find and fix open PR review comments on GitHub.",
    category: "Engineering",
    source: "openai/skills/gh-address-comments",
    trust: "trusted",
    homepage: "https://github.com/openai/skills",
  },
  {
    id: "openai-gh-fix-pr",
    name: "GH fix CI",
    blurb: "Inspect failing GitHub Actions and push a fix.",
    category: "Engineering",
    source: "openai/skills/gh-fix-ci",
    trust: "trusted",
    homepage: "https://github.com/openai/skills",
  },
  {
    id: "openai-create-pr",
    name: "Create PR",
    blurb: "Open a clean pull request with a solid description.",
    category: "Engineering",
    source: "openai/skills/create-pr",
    trust: "trusted",
    homepage: "https://github.com/openai/skills",
  },
  {
    id: "openai-linear",
    name: "Linear",
    blurb: "Create, update, and triage Linear issues from chat.",
    category: "Operations",
    source: "openai/skills/linear",
    trust: "trusted",
    homepage: "https://github.com/openai/skills",
  },
  {
    id: "openai-notion-spec",
    name: "Notion spec to tasks",
    blurb: "Turn a Notion product spec into an actionable task list.",
    category: "Operations",
    source: "openai/skills/notion-spec-to-implementation",
    trust: "trusted",
    homepage: "https://github.com/openai/skills",
  },
  {
    id: "openai-figma",
    name: "Figma implement",
    blurb: "Implement a Figma frame into production UI code.",
    category: "Engineering",
    source: "openai/skills/figma-implement-design",
    trust: "trusted",
    homepage: "https://github.com/openai/skills",
  },
  {
    id: "openai-sentry",
    name: "Sentry triage",
    blurb: "Investigate Sentry issues and propose a fix.",
    category: "Engineering",
    source: "openai/skills/sentry-code-review",
    trust: "trusted",
    homepage: "https://github.com/openai/skills",
  },
  {
    id: "vercel-react-best-practices",
    name: "React best practices",
    blurb: "Vercel’s React and Next.js performance playbook.",
    category: "Engineering",
    source: "vercel-labs/agent-skills/vercel-react-best-practices",
    trust: "trusted",
    homepage: "https://skills.sh/vercel-labs/agent-skills",
  },
  {
    id: "vercel-composition",
    name: "Web design guidelines",
    blurb: "Composition and layout rules for sharp web UI.",
    category: "Engineering",
    source: "vercel-labs/agent-skills/web-design-guidelines",
    trust: "trusted",
    homepage: "https://skills.sh/vercel-labs/agent-skills",
  },
  {
    id: "hf-paper-publisher",
    name: "Paper publisher",
    blurb: "Draft Hugging Face paper pages and model cards.",
    category: "Research",
    source: "huggingface/skills/hugging-face-paper-publisher",
    trust: "trusted",
    homepage: "https://github.com/huggingface/skills",
  },
  {
    id: "hf-model-trainer",
    name: "Model trainer",
    blurb: "Fine-tune and evaluate models on Hugging Face.",
    category: "Research",
    source: "huggingface/skills/hugging-face-model-trainer",
    trust: "trusted",
    homepage: "https://github.com/huggingface/skills",
  },
  {
    id: "hf-dataset-creator",
    name: "Dataset creator",
    blurb: "Build and publish datasets on the Hub.",
    category: "Research",
    source: "huggingface/skills/hugging-face-dataset-creator",
    trust: "trusted",
    homepage: "https://github.com/huggingface/skills",
  },
  {
    id: "nvidia-cudf",
    name: "cuDF",
    blurb: "GPU DataFrames — pandas acceleration with NVIDIA cuDF.",
    category: "MLOps",
    source: "NVIDIA/skills/accelerated-computing-cudf",
    trust: "trusted",
    homepage: "https://github.com/NVIDIA/skills",
  },
  {
    id: "nvidia-cuopt",
    name: "cuOpt",
    blurb: "Decision optimization with NVIDIA cuOpt.",
    category: "MLOps",
    source: "NVIDIA/skills/cuopt-developer",
    trust: "trusted",
    homepage: "https://github.com/NVIDIA/skills",
  },
  {
    id: "gstack-browse",
    name: "Browse",
    blurb: "Drive a real browser for research and QA (gstack).",
    category: "Research",
    source: "garrytan/gstack/browse",
    trust: "community",
    homepage: "https://github.com/garrytan/gstack",
  },
  {
    id: "gstack-ship",
    name: "Ship",
    blurb: "Review, test, and open the PR when the work is ready.",
    category: "Engineering",
    source: "garrytan/gstack/ship",
    trust: "community",
    homepage: "https://github.com/garrytan/gstack",
  },
  {
    id: "gstack-plan-ceo",
    name: "Plan (CEO review)",
    blurb: "Stress-test an implementation plan before coding.",
    category: "Operations",
    source: "garrytan/gstack/plan-ceo-review",
    trust: "community",
    homepage: "https://github.com/garrytan/gstack",
  },
  {
    id: "superpowers-tdd",
    name: "Test-driven development",
    blurb: "Red → green → refactor with tight feedback loops.",
    category: "Engineering",
    source: "obra/superpowers/test-driven-development",
    trust: "community",
    homepage: "https://skills.sh/obra/superpowers",
  },
  {
    id: "superpowers-debugging",
    name: "Systematic debugging",
    blurb: "Root-cause debugging instead of shotgun patches.",
    category: "Engineering",
    source: "obra/superpowers/systematic-debugging",
    trust: "community",
    homepage: "https://skills.sh/obra/superpowers",
  },
  {
    id: "superpowers-writing-plans",
    name: "Writing plans",
    blurb: "Break work into a bite-sized implementation plan.",
    category: "Operations",
    source: "obra/superpowers/writing-plans",
    trust: "community",
    homepage: "https://skills.sh/obra/superpowers",
  },
  {
    id: "find-skills",
    name: "Find skills",
    blurb: "Discover and install Agent Skills from the open ecosystem.",
    category: "Meta",
    source: "vercel-labs/skills/find-skills",
    trust: "trusted",
    homepage: "https://skills.sh/vercel-labs/skills",
  },
];

export const SKILLS_STORE_CATEGORIES: readonly string[] = [
  ...new Set(SKILLS_STORE_CATALOG.map((row) => row.category)),
];

export function getSkillsStoreListing(
  id: string,
): SkillsStoreListing | undefined {
  return SKILLS_STORE_CATALOG.find((row) => row.id === id);
}

export function filterSkillsStore(
  catalog: readonly SkillsStoreListing[],
  query: string,
  category: string | null,
): SkillsStoreListing[] {
  const q = query.trim().toLowerCase();
  return catalog.filter((row) => {
    if (category && row.category !== category) return false;
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      row.blurb.toLowerCase().includes(q) ||
      row.category.toLowerCase().includes(q) ||
      row.source.toLowerCase().includes(q) ||
      row.id.toLowerCase().includes(q)
    );
  });
}
