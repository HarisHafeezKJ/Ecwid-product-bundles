export function formatMoney(amount) {
    const safe = Number.isFinite(amount) ? amount : 0;
    return `$${safe.toFixed(2)}`;
}
export function clampDiscountValue(type, value) {
    if (type === 'NONE')
        return 0;
    if (type === 'PERCENTAGE')
        return Math.min(100, Math.max(0, value));
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, value);
}
export function bundleLineSale(unitPrice, discountType, discountValue) {
    const unit = Number.isFinite(unitPrice) ? unitPrice : 0;
    const clamped = clampDiscountValue(discountType, discountValue);
    switch (discountType) {
        case 'NONE':
            return unit;
        case 'PERCENTAGE':
            return unit * (1 - clamped / 100);
        case 'FIXED_AMOUNT':
            return Math.max(0, unit - clamped);
        case 'SET_PRICE':
            return Math.min(unit, clamped);
        default:
            return unit;
    }
}
export function volumeUnitPrice(basePrice, tier) {
    const base = Number.isFinite(basePrice) ? basePrice : 0;
    const { discountType, discountValue, qty } = tier;
    const clamped = clampDiscountValue(discountType, discountValue);
    const tierQty = Math.max(1, qty);
    switch (discountType) {
        case 'PERCENTAGE':
            return base * (1 - clamped / 100);
        case 'FIXED_AMOUNT': {
            const perUnitOff = clamped / tierQty;
            return Math.max(0, base - perUnitOff);
        }
        case 'SET_PRICE':
            return Math.min(base, clamped);
        default:
            return base;
    }
}
export function exactVolumeUnitPrice(basePrice, tier) {
    return volumeUnitPrice(basePrice, tier);
}
export function isTierDiscountable(tier) {
    if (tier.discountType === 'SET_PRICE')
        return true;
    return tier.discountValue > 0;
}
export function tierDiscountType(value) {
    if (value === 'PERCENTAGE' || value === 'FIXED_AMOUNT' || value === 'SET_PRICE') {
        return value;
    }
    return 'PERCENTAGE';
}
