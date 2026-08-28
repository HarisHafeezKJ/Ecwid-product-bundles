export const PLAN_VIEW_LIMITS = {
    FREE: 1000,
    STARTER: 5000,
    GROWTH: 25000,
    PRO: 100000,
};
export function viewLimitForPlan(plan) {
    return PLAN_VIEW_LIMITS[plan] ?? PLAN_VIEW_LIMITS.FREE;
}
export function currentViewsPeriod(now = new Date()) {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}
export function canUseRuleType(_plan, _ruleType) {
    return true;
}
export function canSeeRoi(_plan) {
    return true;
}
export function canUseUpsells(_plan) {
    return true;
}
