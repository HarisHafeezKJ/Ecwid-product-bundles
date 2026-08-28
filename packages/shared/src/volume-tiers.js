import { asNumber, asString } from './guards.js';
import { isTierDiscountable, tierDiscountType } from './pricing.js';
export function parseVolumeTiers(raw) {
    if (Array.isArray(raw)) {
        return raw.map(parseVolumeTier).filter((tier) => tier.qty >= 1);
    }
    if (raw && typeof raw === 'object' && 'tiers' in raw) {
        return parseVolumeTiers(raw.tiers);
    }
    return [];
}
function parseVolumeTier(raw) {
    const row = raw && typeof raw === 'object' ? raw : {};
    return {
        qty: Math.max(1, Math.floor(asNumber(row.qty, 1))),
        discountType: tierDiscountType(row.discountType),
        discountValue: asNumber(row.discountValue, 0),
        title: asString(row.title),
        imageUrl: asString(row.imageUrl),
        imageRadius: asNumber(row.imageRadius, 0),
        imageSize: asNumber(row.imageSize, 86),
    };
}
export function exactVolumeTier(tiers, qty) {
    const floorQty = Math.floor(qty);
    return tiers.find((tier) => tier.qty === floorQty && isTierDiscountable(tier));
}
export function bestVolumeTier(tiers, qty) {
    const floorQty = Math.floor(qty);
    const matching = tiers
        .filter((tier) => floorQty >= tier.qty && isTierDiscountable(tier))
        .sort((a, b) => b.qty - a.qty);
    return matching[0];
}
export function defaultVolumeTiersForRuleType(ruleType) {
    if (ruleType === 'MIX_AND_MATCH') {
        return [
            { qty: 2, discountType: 'PERCENTAGE', discountValue: 5, title: 'Tier 1' },
            { qty: 3, discountType: 'PERCENTAGE', discountValue: 10, title: 'Tier 2' },
            { qty: 4, discountType: 'PERCENTAGE', discountValue: 15, title: 'Tier 3' },
        ];
    }
    return [
        { qty: 1, discountType: 'PERCENTAGE', discountValue: 0, title: '#1 Deal Offer' },
        { qty: 2, discountType: 'PERCENTAGE', discountValue: 10, title: '#2 Deal Offer' },
        { qty: 3, discountType: 'PERCENTAGE', discountValue: 15, title: '#3 Deal Offer' },
    ];
}
export function mixRequiredCount(rule) {
    const tiers = rule.volumeTiers?.tiers ?? [];
    if (tiers.length > 0) {
        return Math.min(...tiers.map((tier) => tier.qty));
    }
    return Math.max(1, rule.requiredCount ?? 1);
}
export function validateTierSequence(tiers, options = {}) {
    const { exactQty = false, minTiers = 2, maxTiers = 5 } = options;
    const errors = [];
    if (tiers.length < minTiers) {
        errors.push('Add at least two tiers.');
        return errors;
    }
    if (tiers.length > maxTiers) {
        errors.push(`Maximum ${maxTiers} tiers allowed.`);
    }
    let previousQty = 0;
    for (const tier of tiers) {
        if (tier.qty < 1) {
            errors.push('Each tier quantity must be at least 1.');
        }
        else if (tier.qty <= previousQty) {
            errors.push('Each tier quantity must be greater than the previous.');
            break;
        }
        previousQty = tier.qty;
        if (tier.discountType === 'PERCENTAGE' && tier.discountValue > 100) {
            errors.push('Percentage discounts cannot exceed 100%.');
        }
        else if (tier.discountValue < 0) {
            errors.push('Enter a valid discount value for each tier.');
        }
        else if (!exactQty && tier.discountType !== 'SET_PRICE' && tier.discountValue <= 0) {
            errors.push('Enter a valid discount value for each tier.');
        }
    }
    return errors;
}
