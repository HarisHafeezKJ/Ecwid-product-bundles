import { currentViewsPeriod, viewLimitForPlan } from './plan.js';
export const DEFAULT_SETTINGS = {
    title: 'Default',
    widgetTitle: 'Frequently Bought Together',
    buttonLabel: 'Add Bundle to Cart',
    showSavingsBadge: true,
    themeSyncEnabled: true,
    stockShieldEnabled: true,
    stockThreshold: 1,
    planTier: 'FREE',
    monthlyViewsLimit: viewLimitForPlan('FREE'),
    currentViewsCount: 0,
    viewsPeriod: currentViewsPeriod(),
    cartUpsellEnabled: false,
};
export function mergeSettings(storeId, partial) {
    return {
        ...DEFAULT_SETTINGS,
        storeId,
        ...partial,
        monthlyViewsLimit: partial?.monthlyViewsLimit ??
            viewLimitForPlan(partial?.planTier ?? DEFAULT_SETTINGS.planTier),
    };
}
