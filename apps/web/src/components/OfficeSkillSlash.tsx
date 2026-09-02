import { unstable_useComposerInput } from "@assistant-ui/react";
import { useQuery } from "@tanstack/react-query";
import { matchOfficeSkills } from "../lib/knowledge-slash";
import { officeSkills } from "../lib/knowledge-tree";
import { orpc } from "../lib/orpc";
import { THINK_MESSAGES_GC_TIME } from "../lib/think-messages";

const MAX_HITS = 8;

/** Office skills when the composer starts with `/`. */
export function OfficeSkillSlash() {
  const { value, setText } = unstable_useComposerInput();
  const listing = useQuery({
    ...orpc.knowledge.list.queryOptions(),
    enabled: value.trimStart().startsWith("/"),
    gcTime: THINK_MESSAGES_GC_TIME,
  });
  const hits = matchOfficeSkills(
    value,
    officeSkills(listing.data?.entries ?? []),
  ).slice(0, MAX_HITS);
  if (hits.length === 0) return null;
  return (
    <ul className="skill-slash" role="listbox" aria-label="Office skills">
      {hits.map((skill) => (
        <li key={skill.name}>
          <button
            className="skill-slash-item"
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setText(`/${skill.name} `)}
          >
            <span className="skill-slash-name">/{skill.name}</span>
            {skill.description ? (
              <span className="skill-slash-desc">{skill.description}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
