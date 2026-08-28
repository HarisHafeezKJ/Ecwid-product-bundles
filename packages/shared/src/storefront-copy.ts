import type { WidgetStyle } from './types.js';

export function checkoutCtaLabel(selectedCount: number): string {
  const count = Math.max(0, Math.floor(selectedCount));
  const noun = count === 1 ? 'item' : 'items';
  return `Add ${count} ${noun} & checkout →`;
}

export function addToCartErrorText(style?: WidgetStyle): string {
  return style?.addToCartErrorText?.trim() || 'Could not add to cart.';
}

export function addingToCartText(style?: WidgetStyle): string {
  return style?.addingToCartText?.trim() || 'Adding...';
}

export function blockTitleText(style?: WidgetStyle, fallback = 'Special Offer'): string {
  return style?.blockTitle?.trim() || fallback;
}

export function addToCartText(style?: WidgetStyle, fallback = 'Add to Cart'): string {
  return style?.addToCartText?.trim() || fallback;
}

export function volumeUnavailableText(style?: WidgetStyle): string {
  return style?.volumeUnavailableText?.trim() || 'Volume product is unavailable.';
}

export function outOfStockText(style?: WidgetStyle): string {
  return style?.outOfStockText?.trim() || 'Out of stock';
}

export function unavailableOptionText(style?: WidgetStyle): string {
  return style?.unavailableOptionText?.trim() || 'Unavailable';
}

export function upsellSelectedText(style?: WidgetStyle): string {
  return style?.buyAllTagText?.trim() || 'Selected ✓';
}

export function summaryBuyText(style?: WidgetStyle): string {
  return style?.summaryBuy?.trim() || 'Buy';
}

export function summarySaveText(style?: WidgetStyle): string {
  return style?.summarySave?.trim() || 'Save';
}

export function standardPriceText(style?: WidgetStyle): string {
  return style?.standardPriceText?.trim() || 'Standard price';
}

export function buyAllAtText(style?: WidgetStyle): string {
  return style?.buyAllAtText?.trim() || 'Buy all at';
}
