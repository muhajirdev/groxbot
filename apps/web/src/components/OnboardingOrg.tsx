import { useState } from "react";
import { Button, cn, Field, Input, Textarea } from "../ui";

export type OnboardingOrgValues = {
  name: string;
  goal: string;
  team: string;
};

export function OnboardingOrg(props: {
  defaultName: string;
  error?: string;
  busy?: boolean;
  className?: string;
  onCreate: (input: OnboardingOrgValues) => void;
}) {
  const [step, setStep] = useState<"name" | "goal">("name");
  const [name, setName] = useState(props.defaultName);
  const [goal, setGoal] = useState("");
  const [team, setTeam] = useState("");
  const ready = Boolean(name.trim()) && !props.busy;

  function submitName() {
    if (!name.trim() || props.busy) return;
    setStep("goal");
  }

  function submitOffice(next: { goal: string; team: string }) {
    const trimmed = name.trim();
    if (!trimmed || props.busy) return;
    props.onCreate({ name: trimmed, goal: next.goal, team: next.team });
  }

  return (
    <div className={cn("onboard-org", props.className)}>
      <div className="onboard-org-card">
        <div className="onboard-org-steps" aria-hidden>
          <span className={step === "name" ? "is-on" : "is-done"} />
          <span className={step === "goal" ? "is-on" : ""} />
        </div>
        {step === "name" ? (
          <form
            className="onboard-org-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitName();
            }}
          >
            <h1>What do people call this team?</h1>
            <p className="onboard-org-lede">
              The name on the door — pick something teammates will recognize.
            </p>
            <Field label="Name" className="mb-0">
              <Input
                autoFocus
                value={name}
                placeholder="e.g. Northwind Labs"
                maxLength={80}
                autoComplete="organization"
                onValueChange={setName}
              />
            </Field>
            {props.error ? (
              <p className="m-0 text-[12px] text-danger" role="alert">
                {props.error}
              </p>
            ) : null}
            <div className="onboard-org-foot">
              <Button type="submit" disabled={!ready}>
                Continue
              </Button>
            </div>
          </form>
        ) : (
          <form
            className="onboard-org-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitOffice({ goal, team });
            }}
          >
            <h1>What are you building?</h1>
            <p className="onboard-org-lede">
              A short hint in the knowledge library. The team can edit it later.
              Skip if you'd rather say it in a room.
            </p>
            <Field label="Goal" className="mb-0">
              <Textarea
                name="goal"
                autoFocus
                value={goal}
                rows={3}
                maxLength={2000}
                placeholder="Ship a weekly product, help sales, keep the office honest…"
                onChange={(event) => setGoal(event.target.value)}
              />
            </Field>
            <Field label="Who's the team?" className="mb-0">
              <Input
                value={team}
                placeholder="Founders, design, and a few engineers"
                maxLength={240}
                onValueChange={setTeam}
              />
            </Field>
            {props.error ? (
              <p className="m-0 text-[12px] text-danger" role="alert">
                {props.error}
              </p>
            ) : null}
            <div className="onboard-org-foot">
              <Button
                className="onboard-org-skip"
                variant="text"
                type="button"
                disabled={props.busy}
                onClick={() => submitOffice({ goal: "", team: "" })}
              >
                Skip
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="text"
                  type="button"
                  disabled={props.busy}
                  onClick={() => setStep("name")}
                >
                  Back
                </Button>
                <Button type="submit" disabled={props.busy}>
                  {props.busy ? "Opening…" : "Continue"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
