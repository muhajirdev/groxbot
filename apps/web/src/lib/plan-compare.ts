/** Monthly list prices for the people stepper. Claude / ChatGPT $20 per person. */

export const GROXBOT_PRO_MONTHLY_USD = 29;
export const GROXBOT_PLUS_MONTHLY_USD = 49;
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
