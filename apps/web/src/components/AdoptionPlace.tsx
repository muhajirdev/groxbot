import type { WorkspaceMember } from "@groxbot/contracts";
import {
  adoptionHeatLevel,
  adoptionHeatmap,
  buildAdoption,
} from "@groxbot/core/browser";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { OFFICE_MESSAGES_GC_TIME } from "../lib/office-messages";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { tenantBoundQueryFn } from "../lib/tenant-query";
import { cn } from "../ui";
import { PersonAvatar } from "./PersonAvatar";
import { knowledgeTaskListQueryOptions } from "./RoomBoard";

const WEEKDAYS = [
  { id: "sun", label: "" },
  { id: "mon", label: "M" },
  { id: "tue", label: "" },
  { id: "wed", label: "W" },
  { id: "thu", label: "" },
  { id: "fri", label: "F" },
  { id: "sat", label: "" },
] as const;

const membersKey = orpc.workspaces.members.queryOptions().queryKey;

export function AdoptionPlace(props: {
  me?: {
    userId: string;
    name: string;
    email?: string;
    image?: string | null;
  } | null;
}) {
  const listed = useQuery(knowledgeTaskListQueryOptions());
  const membersQuery = useQuery({
    ...orpc.workspaces.members.queryOptions(),
    gcTime: OFFICE_MESSAGES_GC_TIME,
    queryFn: tenantBoundQueryFn(membersKey, () => client.workspaces.members()),
  });
  const tasks = listed.data?.tasks ?? [];
  const members = membersQuery.data ?? fallbackMember(props.me);
  const [picked, setPicked] = useState<string | null>(null);
  const snapshot = useMemo(
    () => buildAdoption(tasks, members),
    [members, tasks],
  );
  const heatCounts = picked
    ? (snapshot.personDays.get(picked) ?? new Map<string, number>())
    : snapshot.days;
  const heat = useMemo(
    () => adoptionHeatmap(heatCounts, new Date()),
    [heatCounts],
  );
  const pickedPerson = snapshot.people.find((row) => row.userId === picked);
  const total = pickedPerson
    ? pickedPerson.contributionCount
    : snapshot.contributionCount;

  return (
    <div className="adoption-place">
      <header className="adoption-head">
        <div className="min-w-0">
          <h1 className="m-0 text-[15px] font-semibold tracking-tight">
            Adoption
          </h1>
          <p className="m-0 text-[13px] text-muted">
            Who put work in motion. Tasks count for the person who asked — not
            the bot.
          </p>
        </div>
      </header>
      <section className="adoption-heat-card" aria-label="Contributions">
        <div className="flex items-baseline justify-between gap-3">
          <strong className="text-[13px] font-semibold tracking-tight">
            {total === 0
              ? "No contributions yet"
              : `${total} contribution${total === 1 ? "" : "s"}`}
            {pickedPerson ? ` · ${pickedPerson.name}` : ""}
          </strong>
          {picked ? (
            <button
              type="button"
              className="border-0 bg-transparent p-0 text-[12px] text-muted"
              onClick={() => setPicked(null)}
            >
              Everyone
            </button>
          ) : null}
        </div>
        <div className="adoption-heat">
          <span className="adoption-heat-pad" />
          <ol className="adoption-heat-months">
            {heat.months.map((month) => (
              <li
                key={`${month.label}-${month.weekIndex}`}
                style={{ gridColumn: month.weekIndex + 1 }}
              >
                {month.label}
              </li>
            ))}
          </ol>
          <ol className="adoption-heat-days" aria-hidden>
            {WEEKDAYS.map((day) => (
              <li key={day.id}>{day.label}</li>
            ))}
          </ol>
          <div className="adoption-heat-weeks">
            {heat.weeks.map((week) => (
              <div key={week[0]?.date} className="adoption-heat-week">
                {week.map((cell) => (
                  <span
                    key={cell.date}
                    className="adoption-heat-cell"
                    data-level={cell.future ? 0 : adoptionHeatLevel(cell.count)}
                    data-future={cell.future ? "true" : undefined}
                    title={
                      cell.future ? undefined : `${cell.count} on ${cell.date}`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="adoption-heat-legend">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className="adoption-heat-cell"
              data-level={level}
            />
          ))}
          More
        </p>
      </section>
      <section aria-label="People">
        {snapshot.people.length === 0 ? (
          <div className="adoption-empty">
            <p className="m-0 text-[15px] font-semibold tracking-tight text-ink">
              No people yet
            </p>
            <p className="m-0 max-w-[40ch] text-center text-[13px] text-muted">
              Invite the team. Adoption is shared proof, not a personal streak.
            </p>
          </div>
        ) : (
          <ul className="adoption-people">
            {snapshot.people.map((person) => (
              <li key={person.userId}>
                <button
                  type="button"
                  className={cn(
                    "adoption-person",
                    picked === person.userId && "is-on",
                  )}
                  aria-pressed={picked === person.userId}
                  onClick={() =>
                    setPicked((id) =>
                      id === person.userId ? null : person.userId,
                    )
                  }
                >
                  <PersonAvatar
                    name={person.name}
                    image={person.image}
                    size="md"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">
                      {person.name}
                    </span>
                    <span className="text-[12px] text-muted">
                      {person.taskCount}{" "}
                      {person.taskCount === 1 ? "task" : "tasks"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function fallbackMember(
  me?: {
    userId: string;
    name: string;
    email?: string;
    image?: string | null;
  } | null,
): WorkspaceMember[] {
  if (!me?.userId) return [];
  return [
    {
      userId: me.userId,
      name: me.name,
      email: me.email || "you@office",
      image: me.image ?? null,
      role: "owner",
      mine: true,
    },
  ];
}
