export function asString(value, fallback = '') {
    if (typeof value === 'string')
        return value;
    if (value == null)
        return fallback;
    return String(value);
}
export function asNumber(value, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value);
        if (Number.isFinite(n))
            return n;
    }
    return fallback;
}
export function asBoolean(value, fallback = false) {
    if (typeof value === 'boolean')
        return value;
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    return fallback;
}
export function asStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((v) => asString(v)).filter(Boolean);
}
export function isRuleType(value) {
    return (value === 'FIXED_BUNDLE' ||
        value === 'MIX_AND_MATCH' ||
        value === 'VOLUME_DISCOUNT' ||
        value === 'CART_UPSELL');
}
export function isDiscountType(value) {
    return (value === 'NONE' ||
        value === 'PERCENTAGE' ||
        value === 'FIXED_AMOUNT' ||
        value === 'SET_PRICE');
}
