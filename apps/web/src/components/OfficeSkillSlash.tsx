import { unstable_useComposerInput } from "@assistant-ui/react";
import { useQuery } from "@tanstack/react-query";
import { matchOfficeLearn, matchOfficeSkills } from "../lib/knowledge-slash";
import { officeSkills } from "../lib/knowledge-tree";
import { knowledgeListQueryOptions } from "../lib/workspace-catalog";

const MAX_HITS = 8;

/** Office skills when the composer starts with `/`. */
export function OfficeSkillSlash() {
  const { value, setText } = unstable_useComposerInput();
  const listing = useQuery({
    ...knowledgeListQueryOptions(),
    enabled: value.trimStart().startsWith("/"),
  });
  const learn = matchOfficeLearn(value);
  const hits = matchOfficeSkills(
    value,
    officeSkills(listing.data?.entries ?? []),
  ).slice(0, MAX_HITS);
  if (!learn && hits.length === 0) return null;
  return (
    <ul
      className="skill-slash popover-popup popover-mount rounded-[10px] border border-line bg-card"
      role="listbox"
      aria-label="Office skills"
    >
      {learn ? (
        <li>
          <button
            className="skill-slash-item"
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setText("/learn ")}
          >
            <span className="skill-slash-name">/learn</span>
            <span className="skill-slash-desc">
              Turn a source or workflow into a skill.
            </span>
          </button>
        </li>
      ) : null}
      {hits.map((skill) => (
        <li key={skill.name}>
          <button
            className="skill-slash-item"
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setText(`/skill:${skill.name} `)}
          >
            <span className="skill-slash-name">/skill:{skill.name}</span>
            {skill.description ? (
              <span className="skill-slash-desc">{skill.description}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
