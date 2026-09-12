export function planGateCopy(trialAvailable: boolean): {
  title: string;
  body: string;
  cta: string;
} {
  if (trialAvailable) {
    return {
      title: "Start free trial",
      body: "Three days of Pro. Start it in the web office.",
      cta: "Open web office",
    };
  }
  return {
    title: "Your trial ended",
    body: "Change the workspace plan in the web office.",
    cta: "Open web office",
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
