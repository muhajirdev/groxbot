export function planGateCopy(trialAvailable: boolean): {
  title: string;
  body: string;
  cta: string;
} {
  if (trialAvailable) {
    return {
      title: "Start free trial",
      body: "Three days of Pro. Card on file — cancel before it ends and you are not charged.",
      cta: "Start free trial",
    };
  }
  return {
    title: "Your trial ended",
    body: "Subscribe to keep talking with your teammates.",
    cta: "See plans",
  };
}

export function onboardingPlanReady(
  me: { workspaceId?: string | null } | null | undefined,
  workspaceId: string,
): boolean {
  return me?.workspaceId === workspaceId;
}

export function onboardingNeedsPlan(
  me:
    | { workspaceId?: string | null; needsHostedPlan?: boolean }
    | null
    | undefined,
  workspaceId: string,
): boolean {
  if (me?.workspaceId !== workspaceId) return true;
  return me.needsHostedPlan !== false;
}
