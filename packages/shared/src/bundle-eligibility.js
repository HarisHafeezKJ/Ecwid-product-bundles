import { exactVolumeTier, mixRequiredCount } from './volume-tiers.js';
import { mixPoolProductIds } from './rule-placement.js';
export function lineItemsToCartQty(lines) {
    const map = {};
    for (const line of lines) {
        if (!line.productId)
            continue;
        map[line.productId] = (map[line.productId] ?? 0) + Math.max(0, line.quantity);
    }
    return map;
}
export function cartQtyForProduct(lines, productId) {
    return lines
        .filter((line) => line.productId === productId)
        .reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
}
export function mixMatchCartQty(lines, poolIds, collectionProductIds = []) {
    const pool = new Set(poolIds.length > 0 ? poolIds : collectionProductIds.filter(Boolean));
    return lines
        .filter((line) => pool.has(line.productId))
        .reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
}
export function isCartUpsellTriggered(rule, lines) {
    if (rule.ruleType !== 'CART_UPSELL')
        return false;
    const triggers = new Set(rule.triggerProductIds.filter(Boolean));
    if (triggers.size === 0)
        return false;
    return lines.some((line) => triggers.has(line.productId) && line.quantity > 0);
}
export function uniqueVolumeRuleForProduct(rules, productId) {
    const matching = rules.filter((rule) => rule.ruleType === 'VOLUME_DISCOUNT' &&
        rule.status === 'ACTIVE' &&
        volumeRuleClaimsProduct(rule, productId));
    if (matching.length === 1)
        return matching[0];
    return undefined;
}
function volumeRuleClaimsProduct(rule, productId) {
    if (rule.applyToAllProducts)
        return true;
    const targets = (rule.items?.components ?? []).map((item) => item.productId).filter(Boolean);
    return targets.includes(productId);
}
function isFixedBundleEligible(rule, lines) {
    const items = rule.items?.components ?? [];
    if (items.length < 2)
        return false;
    return items.every((item) => {
        const minQty = Math.max(1, item.minQuantity ?? 1);
        return cartQtyForProduct(lines, item.productId) >= minQty;
    });
}
function isVolumeDiscountEligible(rule, lines) {
    const tiers = rule.volumeTiers?.tiers ?? [];
    if (tiers.length === 0)
        return false;
    if (rule.applyToAllProducts) {
        return lines.some((line) => exactVolumeTier(tiers, line.quantity) != null);
    }
    const targets = new Set((rule.items?.components ?? []).map((item) => item.productId).filter(Boolean));
    return lines.some((line) => targets.has(line.productId) && exactVolumeTier(tiers, line.quantity) != null);
}
function isMixAndMatchEligible(rule, lines, collectionProductIds = []) {
    const pool = mixPoolProductIds(rule, collectionProductIds);
    if (pool.length === 0)
        return false;
    const required = mixRequiredCount(rule);
    return mixMatchCartQty(lines, pool, collectionProductIds) >= required;
}
export function isRuleEligible(rule, lines, options = {}) {
    if (rule.status !== 'ACTIVE')
        return false;
    switch (rule.ruleType) {
        case 'FIXED_BUNDLE':
            return isFixedBundleEligible(rule, lines);
        case 'VOLUME_DISCOUNT':
            return isVolumeDiscountEligible(rule, lines);
        case 'MIX_AND_MATCH':
            return isMixAndMatchEligible(rule, lines, options.collectionProductIds);
        case 'CART_UPSELL':
            return isCartUpsellTriggered(rule, lines);
        default:
            return false;
    }
}
