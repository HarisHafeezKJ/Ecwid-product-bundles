export function checkoutCtaLabel(selectedCount) {
    const count = Math.max(0, Math.floor(selectedCount));
    const noun = count === 1 ? 'item' : 'items';
    return `Add ${count} ${noun} & checkout →`;
}
export function addToCartErrorText(style) {
    return style?.addToCartErrorText?.trim() || 'Could not add to cart.';
}
export function addingToCartText(style) {
    return style?.addingToCartText?.trim() || 'Adding...';
}
export function blockTitleText(style, fallback = 'Special Offer') {
    return style?.blockTitle?.trim() || fallback;
}
export function addToCartText(style, fallback = 'Add to Cart') {
    return style?.addToCartText?.trim() || fallback;
}
export function volumeUnavailableText(style) {
    return style?.volumeUnavailableText?.trim() || 'Volume product is unavailable.';
}
export function outOfStockText(style) {
    return style?.outOfStockText?.trim() || 'Out of stock';
}
export function unavailableOptionText(style) {
    return style?.unavailableOptionText?.trim() || 'Unavailable';
}
export function upsellSelectedText(style) {
    return style?.buyAllTagText?.trim() || 'Selected ✓';
}
export function summaryBuyText(style) {
    return style?.summaryBuy?.trim() || 'Buy';
}
export function summarySaveText(style) {
    return style?.summarySave?.trim() || 'Save';
}
export function standardPriceText(style) {
    return style?.standardPriceText?.trim() || 'Standard price';
}
export function buyAllAtText(style) {
    return style?.buyAllAtText?.trim() || 'Buy all at';
}
