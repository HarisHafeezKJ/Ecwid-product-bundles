export const MIX_COPY_DEFAULTS = {
    blockTitle: 'Mix & Match',
    addToCartText: 'Add to Cart',
    addingToCartText: 'Adding...',
    qtyPromptText: 'Select {{COUNT}} more',
    summaryTitle: 'Your mix',
    summarySubtitle: 'Bundle summary',
    summaryBuy: 'Buy',
    summarySave: 'Save',
    standardPriceText: 'Standard price',
    salePriceText: 'Sale price',
    totalItemsLabel: 'Total items',
    savingsBadgeText: 'Save',
    variantLabel: 'Variation',
    outOfStockText: 'Out of stock',
    unavailableOptionText: 'Unavailable',
    addToCartErrorText: 'Could not add to cart.',
    checkoutLabel: 'Mix & Match',
    promoLabel: 'Mix & Match',
    buyAllAtText: 'Total',
    buyAllTagText: 'Mix deal',
};
const COUNT_TOKEN = /\{\{COUNT\}\}/gi;
export function mixCtaLabel(template, remaining) {
    const safeTemplate = template?.trim() || MIX_COPY_DEFAULTS.qtyPromptText || 'Select {{COUNT}} more';
    const count = Math.max(0, Math.ceil(remaining));
    return safeTemplate.replace(COUNT_TOKEN, String(count));
}
export function mixRemainingCount(selectedQty, requiredQty) {
    return Math.max(0, requiredQty - selectedQty);
}
export function mixCtaReady(selectedQty, requiredQty) {
    return selectedQty >= requiredQty;
}
export function applyMixCopyDefaults(style = {}) {
    return { ...MIX_COPY_DEFAULTS, ...style };
}
