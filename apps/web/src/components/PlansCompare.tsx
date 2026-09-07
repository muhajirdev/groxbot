import {
  PRO_TRIAL_INTERVAL_COUNT,
  WORKSPACE_PLAN_BELIEVERS,
  WORKSPACE_PLAN_PLUS,
  WORKSPACE_PLAN_PRO,
  type WorkspacePlan,
} from "@groxbot/contracts";
import { type ReactNode, useState } from "react";
import {
  BILLING_INTERVAL_MONTH,
  BILLING_INTERVAL_YEAR,
  GROXBOT_PRO_MONTHLY_USD,
  GROXBOT_PRO_YEARLY_USD,
  PLAN_COMPARE_DEFAULT_PEOPLE,
  PLAN_COMPARE_MAX_PEOPLE,
  PLAN_COMPARE_MIN_PEOPLE,
  type BillingInterval,
  isYearlyInterval,
  labChargeLabel,
  labMonthlyUsd,
  peopleLabel,
  planListUsd,
  planPeriodLabel,
  teamProductivityLiftPercent,
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
  onCheckout: (
    plan: SubscribeCheckoutPlan,
    interval: BillingInterval,
  ) => void;
}) {
  const [interval, setInterval] = useState<BillingInterval>(
    BILLING_INTERVAL_MONTH,
  );
  const yearly = isYearlyInterval(interval);
  const period = planPeriodLabel(interval);
  const proCta = props.trialAvailable ? "Start free trial" : "Subscribe";
  const proPrice = planListUsd(WORKSPACE_PLAN_PRO, interval);

  return (
    <>
      <div className="subscribe-interval" role="tablist" aria-label="Billing period">
        <button
          type="button"
          role="tab"
          aria-selected={!yearly}
          className={cn("subscribe-interval-btn", !yearly && "is-on")}
          onClick={() => setInterval(BILLING_INTERVAL_MONTH)}
        >
          Monthly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={yearly}
          className={cn("subscribe-interval-btn", yearly && "is-on")}
          onClick={() => setInterval(BILLING_INTERVAL_YEAR)}
        >
          Annual
          <span>2 months free</span>
        </button>
      </div>
      <div className="subscribe-compare">
        <PlanColumn
          name="Pro"
          price={proPrice}
          period={period}
        >
          <Button
            variant="ghost"
            type="button"
            className="w-full"
            disabled={props.busy !== null}
            onClick={() => props.onCheckout(WORKSPACE_PLAN_PRO, interval)}
          >
            {props.busy === WORKSPACE_PLAN_PRO ? "Starting…" : proCta}
          </Button>
          <p className="subscribe-plan-note">
            {props.trialAvailable
              ? `${PRO_TRIAL_INTERVAL_COUNT}-day trial, then $${proPrice}${period}`
              : yearly
                ? "Billed yearly"
                : "Billed monthly"}
          </p>
          <FeatureList prefix={null} items={PRO_FEATURES} />
        </PlanColumn>
        <PlanColumn
          name="Pro Plus"
          price={planListUsd(WORKSPACE_PLAN_PLUS, interval)}
          period={period}
          popular
        >
          <Button
            type="button"
            className="w-full"
            disabled={props.busy !== null}
            onClick={() => props.onCheckout(WORKSPACE_PLAN_PLUS, interval)}
          >
            {props.busy === WORKSPACE_PLAN_PLUS ? "Starting…" : "Subscribe"}
          </Button>
          <p className="subscribe-plan-note">Everything in Pro</p>
          <FeatureList prefix={null} items={PLUS_FEATURES} />
        </PlanColumn>
        <PlanColumn
          name="Believers"
          price={planListUsd(WORKSPACE_PLAN_BELIEVERS, interval)}
          period={period}
        >
          <Button
            variant="ghost"
            type="button"
            className="w-full"
            disabled={props.busy !== null}
            onClick={() =>
              props.onCheckout(WORKSPACE_PLAN_BELIEVERS, interval)
            }
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
      <HeadcountCompare interval={interval} />
    </>
  );
}

function HeadcountCompare(props: { interval: BillingInterval }) {
  const [people, setPeople] = useState(PLAN_COMPARE_DEFAULT_PEOPLE);
  const count = peopleLabel(people);
  const yearly = isYearlyInterval(props.interval);
  const ours = yearly ? GROXBOT_PRO_YEARLY_USD : GROXBOT_PRO_MONTHLY_USD;
  const lift = teamProductivityLiftPercent(people);

  return (
    <div className="subscribe-headcount">
      <h3 className="subscribe-headcount-title">Pricing comparison</h3>
      <div className="subscribe-headcount-slider">
        <div className="subscribe-headcount-slider-meta">
          <p>
            For <span className="subscribe-headcount-for-count">{count}</span>
          </p>
          <strong className="subscribe-headcount-price">
            ${GROXBOT_PRO_MONTHLY_USD}/mo
          </strong>
        </div>
        <input
          className="subscribe-headcount-range"
          type="range"
          min={PLAN_COMPARE_MIN_PEOPLE}
          max={PLAN_COMPARE_MAX_PEOPLE}
          step={1}
          value={people}
          aria-label="Team size"
          aria-valuemin={PLAN_COMPARE_MIN_PEOPLE}
          aria-valuemax={PLAN_COMPARE_MAX_PEOPLE}
          aria-valuenow={people}
          aria-valuetext={`${count}, Groxbot Pro $${GROXBOT_PRO_MONTHLY_USD} per month, team productivity plus ${lift} percent`}
          onChange={(event) => setPeople(Number(event.target.value))}
        />
        <div className="subscribe-headcount-ends">
          <span>{PLAN_COMPARE_MIN_PEOPLE}</span>
          <span>{PLAN_COMPARE_MAX_PEOPLE}</span>
        </div>
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
          <strong>
            ${ours}
            {planPeriodLabel(props.interval)}
          </strong>
        </div>
        <div className="subscribe-headcount-row lift">
          <span>Team productivity</span>
          <span className="subscribe-headcount-math">
            more headcount, more lift
          </span>
          <strong>+{lift}%</strong>
        </div>
      </div>
    </div>
  );
}

function PlanColumn(props: {
  name: string;
  price: number;
  period: "/mo" | "/yr";
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
          <span>{props.period}</span>
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
