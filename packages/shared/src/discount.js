import { clampDiscountValue } from './pricing.js';
export { clampDiscountValue };
export function discountTypeLabel(type) {
    switch (type) {
        case 'NONE':
            return 'No discount';
        case 'PERCENTAGE':
            return 'Percentage';
        case 'FIXED_AMOUNT':
            return 'Fixed amount';
        case 'SET_PRICE':
            return 'Set price';
        default:
            return type;
    }
}
