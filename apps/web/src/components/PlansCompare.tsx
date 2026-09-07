import {
  PRO_TRIAL_INTERVAL_COUNT,
  WORKSPACE_PLAN_BELIEVERS,
  WORKSPACE_PLAN_PLUS,
  WORKSPACE_PLAN_PRO,
  type WorkspacePlan,
} from "@groxbot/contracts";
import { type ReactNode, useState } from "react";
import {
  GROXBOT_PRO_MONTHLY_USD,
  PLAN_COMPARE_DEFAULT_PEOPLE,
  PLAN_COMPARE_MAX_PEOPLE,
  PLAN_COMPARE_MIN_PEOPLE,
  labChargeLabel,
  labMonthlyUsd,
  peopleLabel,
  stepPlanPeople,
} from "../lib/plan-compare";
import { Button, cn } from "../ui";
import { CheckIcon } from "./Icons";
import { ScheduleDemoButton } from "./ScheduleDemoButton";

export type SubscribeCheckoutPlan = Exclude<WorkspacePlan, "none">;

const PRO_FEATURES = [
  "Teammates with a computer",
  "Knowledge that grows as you work",
  "Plugins",
  "$20 hosted models / month",
  "Live apps — coming soon",
  "Goal and task management — coming soon",
  "Mobile — coming soon",
];

const PLUS_FEATURES = ["Frontier models (GPT-6 Astra, Claude Fable 5.1, …)"];

const BELIEVERS_FEATURES = [
  "$100 hosted models / month",
  "Early access to new features",
  "A direct line when something’s off",
];

export function PlansCompare(props: {
  trialAvailable: boolean;
  busy: SubscribeCheckoutPlan | null;
  error?: string;
  onCheckout: (plan: SubscribeCheckoutPlan) => void;
}) {
  const proCta = props.trialAvailable ? "Start free trial" : "Subscribe";

  return (
    <>
      <div className="subscribe-compare">
        <PlanColumn name="Pro" price={29}>
          <Button
            variant="ghost"
            type="button"
            className="w-full"
            disabled={props.busy !== null}
            onClick={() => props.onCheckout(WORKSPACE_PLAN_PRO)}
          >
            {props.busy === WORKSPACE_PLAN_PRO ? "Starting…" : proCta}
          </Button>
          <p className="subscribe-plan-note">
            {props.trialAvailable
              ? `${PRO_TRIAL_INTERVAL_COUNT}-day trial, then $29/mo`
              : "Billed monthly"}
          </p>
          <FeatureList prefix={null} items={PRO_FEATURES} />
        </PlanColumn>
        <PlanColumn name="Pro Plus" price={49} popular>
          <Button
            type="button"
            className="w-full"
            disabled={props.busy !== null}
            onClick={() => props.onCheckout(WORKSPACE_PLAN_PLUS)}
          >
            {props.busy === WORKSPACE_PLAN_PLUS ? "Starting…" : "Subscribe"}
          </Button>
          <p className="subscribe-plan-note">Everything in Pro</p>
          <FeatureList prefix={null} items={PLUS_FEATURES} />
        </PlanColumn>
        <PlanColumn name="Believers" price={99}>
          <Button
            variant="ghost"
            type="button"
            className="w-full"
            disabled={props.busy !== null}
            onClick={() => props.onCheckout(WORKSPACE_PLAN_BELIEVERS)}
          >
            {props.busy === WORKSPACE_PLAN_BELIEVERS
              ? "Starting…"
              : "Become a Believer"}
          </Button>
          <p className="subscribe-plan-note">
            Everything in Pro Plus · keeps us independent
          </p>
          <FeatureList prefix={null} items={BELIEVERS_FEATURES} />
        </PlanColumn>
      </div>
      {props.error ? <p className="warn mt-3 mb-0">{props.error}</p> : null}
      <div className="subscribe-demo">
        <ScheduleDemoButton className="btn ghost" />
      </div>
      <HeadcountCompare />
    </>
  );
}

function HeadcountCompare() {
  const [people, setPeople] = useState(PLAN_COMPARE_DEFAULT_PEOPLE);
  const count = peopleLabel(people);

  return (
    <div className="subscribe-headcount">
      <div className="subscribe-headcount-stepper">
        <span className="subscribe-headcount-for">For</span>
        <Button
          variant="icon"
          type="button"
          aria-label="Fewer people"
          disabled={people <= PLAN_COMPARE_MIN_PEOPLE}
          onClick={() => setPeople((n) => stepPlanPeople(n, -1))}
        >
          −
        </Button>
        <p>{count}</p>
        <Button
          variant="icon"
          type="button"
          aria-label="More people"
          disabled={people >= PLAN_COMPARE_MAX_PEOPLE}
          onClick={() => setPeople((n) => stepPlanPeople(n, 1))}
        >
          +
        </Button>
      </div>
      <div className="subscribe-headcount-rows">
        <div className="subscribe-headcount-row">
          <span>Claude / ChatGPT</span>
          <span className="subscribe-headcount-math">
            {labChargeLabel(people)}
          </span>
          <strong>${labMonthlyUsd(people)}/mo</strong>
        </div>
        <div className="subscribe-headcount-row ours">
          <span>Groxbot Pro</span>
          <span className="subscribe-headcount-math">always</span>
          <strong>${GROXBOT_PRO_MONTHLY_USD}/mo</strong>
        </div>
      </div>
    </div>
  );
}

function PlanColumn(props: {
  name: string;
  price: number;
  popular?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("subscribe-compare-col", props.popular && "popular")}>
      <div className="subscribe-plan-head">
        <span
          className={
            props.popular ? "subscribe-plan-badge" : "subscribe-plan-badge-slot"
          }
        >
          {props.popular ? "Popular" : "\u00a0"}
        </span>
        <p className="subscribe-plan-name">{props.name}</p>
        <p className="subscribe-plan-price">
          <strong>${props.price}</strong>
          <span>/mo</span>
        </p>
      </div>
      {props.children}
    </div>
  );
}

function FeatureList(props: { prefix: string | null; items: string[] }) {
  return (
    <div className="subscribe-plan-features">
      {props.prefix ? (
        <p className="subscribe-plan-prefix">{props.prefix}</p>
      ) : null}
      <ul>
        {props.items.map((item) => (
          <li key={item}>
            <CheckIcon className="size-3.5 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
