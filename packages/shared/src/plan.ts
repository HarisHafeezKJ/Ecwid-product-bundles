import type { PlanTier } from './types.js';

export const PLAN_VIEW_LIMITS: Record<PlanTier, number> = {
  FREE: 1000,
  STARTER: 5000,
  GROWTH: 25000,
  PRO: 100000,
};

export function viewLimitForPlan(plan: PlanTier): number {
  return PLAN_VIEW_LIMITS[plan] ?? PLAN_VIEW_LIMITS.FREE;
}

export function currentViewsPeriod(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function canUseRuleType(_plan: PlanTier, _ruleType: string): boolean {
  return true;
}

export function canSeeRoi(_plan: PlanTier): boolean {
  return true;
}

export function canUseUpsells(_plan: PlanTier): boolean {
  return true;
}
