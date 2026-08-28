import { formatMoney } from './pricing.js';
export const RULE_TYPE_LABELS = {
    VOLUME_DISCOUNT: 'Quantity break',
    FIXED_BUNDLE: 'Bundle',
    MIX_AND_MATCH: 'Mix & Match',
    CART_UPSELL: 'Upsells',
};
export const DEFAULT_TITLES = {
    VOLUME_DISCOUNT: 'Quantity discount',
    FIXED_BUNDLE: 'Bundle offer',
    MIX_AND_MATCH: 'Mix & Match',
    CART_UPSELL: 'Upsell',
};
export const RULE_TYPE_DESCRIPTIONS = {
    VOLUME_DISCOUNT: 'Tiered discounts when customers buy more of a product.',
    FIXED_BUNDLE: 'Sell a fixed set of products together at a bundle price.',
    MIX_AND_MATCH: 'Let shoppers pick from a pool and unlock tier discounts.',
    CART_UPSELL: 'Suggest related products on the cart page.',
};
export function ruleTypeLabel(ruleType) {
    return RULE_TYPE_LABELS[ruleType] ?? ruleType;
}
export const RULE_STATUS_LABELS = {
    ACTIVE: 'Active',
    DISABLED: 'Paused',
    DRAFT: 'Draft',
};
export function ruleStatusLabel(status) {
    return RULE_STATUS_LABELS[status] ?? status;
}
export function formatDiscount(discountType, discountValue) {
    switch (discountType) {
        case 'NONE':
            return 'No discount';
        case 'PERCENTAGE':
            return `${discountValue}% off`;
        case 'FIXED_AMOUNT':
            return `${formatMoney(discountValue)} off`;
        case 'SET_PRICE':
            return formatMoney(discountValue);
        default:
            return '';
    }
}
export function formatTierDiscount(discountType, discountValue) {
    return formatDiscount(discountType, discountValue);
}
export const DISCOUNT_TYPE_LABELS = {
    NONE: 'No discount',
    PERCENTAGE: 'Percentage off',
    FIXED_AMOUNT: 'Fixed amount off',
    SET_PRICE: 'Set price',
};
export function formatRuleDiscount(rule) {
    if (rule.ruleType === 'CART_UPSELL')
        return '—';
    if (rule.ruleType === 'FIXED_BUNDLE') {
        return formatDiscount(rule.discountType, rule.discountValue);
    }
    const tiers = rule.volumeTiers?.tiers ?? [];
    if (tiers.length === 0)
        return '—';
    const first = tiers[0];
    return `From ${formatTierDiscount(first.discountType, first.discountValue)}`;
}
