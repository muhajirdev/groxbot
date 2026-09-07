/** List prices and the people stepper. Annual is 10 months (2 months free). */

import {
  BILLING_INTERVAL_MONTH,
  BILLING_INTERVAL_YEAR,
  WORKSPACE_PLAN_BELIEVERS,
  WORKSPACE_PLAN_PLUS,
  WORKSPACE_PLAN_PRICE_USD,
  WORKSPACE_PLAN_PRO,
  type BillingInterval,
  type WorkspacePlan,
} from "@groxbot/contracts";

export const GROXBOT_PRO_MONTHLY_USD =
  WORKSPACE_PLAN_PRICE_USD[WORKSPACE_PLAN_PRO].month;
export const GROXBOT_PLUS_MONTHLY_USD =
  WORKSPACE_PLAN_PRICE_USD[WORKSPACE_PLAN_PLUS].month;
export const GROXBOT_BELIEVERS_MONTHLY_USD =
  WORKSPACE_PLAN_PRICE_USD[WORKSPACE_PLAN_BELIEVERS].month;
export const GROXBOT_PRO_YEARLY_USD =
  WORKSPACE_PLAN_PRICE_USD[WORKSPACE_PLAN_PRO].year;

export const PLAN_COMPARE_MIN_PEOPLE = 1;
export const PLAN_COMPARE_MAX_PEOPLE = 20;
export const PLAN_COMPARE_DEFAULT_PEOPLE = 10;

const LAB_SEAT_MONTHLY_USD = 20;

export function clampPlanPeople(people: number): number {
  if (!Number.isFinite(people)) return PLAN_COMPARE_DEFAULT_PEOPLE;
  return Math.min(
    PLAN_COMPARE_MAX_PEOPLE,
    Math.max(PLAN_COMPARE_MIN_PEOPLE, Math.round(people)),
  );
}

export function stepPlanPeople(people: number, delta: number): number {
  return clampPlanPeople(people + delta);
}

export function labMonthlyUsd(people: number): number {
  return clampPlanPeople(people) * LAB_SEAT_MONTHLY_USD;
}

export function labChargeLabel(people: number): string {
  return `$${LAB_SEAT_MONTHLY_USD} × ${clampPlanPeople(people)}`;
}

export function peopleLabel(people: number): string {
  const n = clampPlanPeople(people);
  return n === 1 ? "1 person" : `${n} people`;
}

export function planListUsd(
  plan: Exclude<WorkspacePlan, "none">,
  interval: BillingInterval,
): number {
  return WORKSPACE_PLAN_PRICE_USD[plan][interval];
}

export function planPeriodLabel(interval: BillingInterval): "/mo" | "/yr" {
  return interval === BILLING_INTERVAL_YEAR ? "/yr" : "/mo";
}

export function isYearlyInterval(interval: BillingInterval): boolean {
  return interval === BILLING_INTERVAL_YEAR;
}

export { BILLING_INTERVAL_MONTH, BILLING_INTERVAL_YEAR };
export type { BillingInterval };
