import type { Bot, Routine } from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { client } from "../lib/rpc";
import { ModalShell } from "../ui";
import { CloseIcon, GearIcon } from "./Icons";

const CRONS = [
  { label: "Every day at 9:00", value: "0 9 * * *" },
  { label: "Every night at 22:00", value: "0 22 * * *" },
  { label: "Weekdays at 9:00", value: "0 9 * * 1-5" },
] as const;

export type ComputerActivityItem = { id: string; text: string };

export function ComputerPane(props: {
  bot: Bot;
  statusLabel: string;
  working?: string;
  activity: ComputerActivityItem[];
  onSettings: () => void;
  onCollapse: () => void;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cron, setCron] = useState<string>(CRONS[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const botId = props.bot.id;
  const booting = Boolean(props.working);
  const routinesQuery = useQuery({
    queryKey: ["routines", botId],
    queryFn: () => client.routines.list({ botId }),
    staleTime: 30_000,
  });
  const routines: Routine[] = routinesQuery.data ?? [];

  return (
    <aside className="pane computer-pane">
      <div className="pane-head drag">
        <span className="pane-title">{props.bot.name}'s screen</span>
        <div className="row tight no-drag">
          <button
            className="icon-btn"
            type="button"
            aria-label="Bot settings"
            title="Settings"
            onClick={props.onSettings}
          >
            <GearIcon />
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="Close computer"
            title="Close"
            onClick={props.onCollapse}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="pane-scroll">
        <div className="boot-card">
          {booting ? (
            <>
              <p>{props.statusLabel}</p>
              <div className="progress">
                <i />
              </div>
            </>
          ) : (
            <p className="boot-status">{props.statusLabel}</p>
          )}
        </div>
        <div className="screen-box inset">
          <div className="desk">
            <section className="desk-workspace">
              <p className="desk-kicker">Workspace</p>
              <ul className="desk-tree">
                <li>
                  <span className="desk-dir">/workspace</span>
                </li>
              </ul>
            </section>
            <section className="desk-artifact">
              <p className="desk-empty">
                Files this teammate writes land here. Work continues if you
                close this.
              </p>
            </section>
            <section className="desk-activity">
              <p className="desk-kicker">Activity</p>
              {props.working ? (
                <p className="desk-now">{props.working}</p>
              ) : null}
              <ActivityList
                items={props.activity}
                nowDoing={props.working ?? null}
              />
            </section>
          </div>
        </div>
        <section className="routines">
          <p className="muted">
            Routines are recurring tasks this Bot runs on a schedule.
          </p>
          {routines.length > 0 ? (
            <ul className="routine-list">
              {routines.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <span className="muted">{item.cron}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            className="create-routine"
            type="button"
            onClick={() => {
              setName("");
              setPrompt("");
              setCron(CRONS[0].value);
              setError("");
              setCreating(true);
            }}
          >
            Create Routine
          </button>
        </section>
      </div>
      {creating ? (
        <ModalShell onClose={() => setCreating(false)}>
          <h2>Create Routine</h2>
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nightly Gmail check"
            />
          </label>
          <label className="field">
            <span>Schedule</span>
            <select value={cron} onChange={(e) => setCron(e.target.value)}>
              {CRONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>What to do</span>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <div className="row">
            <button
              className="btn"
              type="button"
              disabled={busy || !name.trim() || !prompt.trim()}
              onClick={() => {
                setBusy(true);
                setError("");
                void client.routines
                  .create({
                    botId: props.bot.id,
                    name,
                    prompt,
                    cron,
                  })
                  .then(async () => {
                    await queryClient.invalidateQueries({
                      queryKey: ["routines", props.bot.id],
                    });
                    setCreating(false);
                  })
                  .catch((caught: unknown) =>
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : "Could not create",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Create
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setCreating(false)}
            >
              Close
            </button>
          </div>
        </ModalShell>
      ) : null}
    </aside>
  );
}

function ActivityList(props: {
  items: ComputerActivityItem[];
  nowDoing: string | null;
}) {
  const rows = props.items.filter((item) => item.text !== props.nowDoing);
  if (rows.length === 0 && !props.nowDoing) {
    return <p className="desk-empty">No recent steps.</p>;
  }
  if (rows.length === 0) return null;
  return (
    <ul className="desk-log">
      {rows.map((item) => (
        <li key={item.id}>{item.text}</li>
      ))}
    </ul>
  );
}
