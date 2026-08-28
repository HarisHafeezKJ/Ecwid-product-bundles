import type { WidgetStyle } from '../types';

const SIZE_KEYS = new Set([
  'blockTitleSize',
  'offerTitleSize',
  'offerSubtitleSize',
  'priceSize',
  'productTitleSize',
  'productQtySize',
  'productPriceSize',
  'optionNameSize',
  'optionItemSize',
  'buyAllAtSize',
  'buyAllAtPriceSize',
  'buyAllAtTagSize',
  'addToCartSize',
  'upsellTitleSize',
  'upsellPriceSize',
]);

const COLOR_KEYS = new Set([
  'blockTitleColor',
  'offerCardBg',
  'offerCardBorder',
  'offerSelectedBg',
  'offerSelectedBorder',
  'offerTitleColor',
  'offerSubtitleColor',
  'priceColor',
  'variantSelectBg',
  'variantSelectBorder',
  'variantSelectColor',
  'addToCartBg',
  'addToCartColor',
  'addToCartActiveBg',
  'addToCartSuccessBg',
  'productTitleColor',
  'productQtyColor',
  'productPriceColor',
  'productDiscountPriceColor',
  'optionNameColor',
  'optionItemColor',
  'dividerColor',
  'buyAllAtColor',
  'buyAllAtPriceColor',
  'buyAllAtTagBg',
  'buyAllAtTagColor',
  'upsellCardBg',
  'upsellCardBorder',
  'upsellSelectedBg',
  'upsellSelectedBorder',
  'upsellTitleColor',
  'upsellPriceColor',
  'checkoutCtaBg',
  'checkoutCtaColor',
]);

export function widgetStyleCssVars(style: WidgetStyle, prefix = 'pb'): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, raw] of Object.entries(style)) {
    if (raw == null || raw === '') continue;
    const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const name = `--${prefix}-${kebab}`;
    if (SIZE_KEYS.has(key)) {
      const n = Number(raw);
      if (!Number.isNaN(n)) vars[name] = `${n}px`;
      continue;
    }
    if (COLOR_KEYS.has(key) || key.endsWith('Color') || key.endsWith('Bg') || key.endsWith('Border')) {
      vars[name] = String(raw);
    }
  }
  return vars;
}

export function applyWidgetStyle(el: HTMLElement, style: WidgetStyle): void {
  const vars = widgetStyleCssVars(style);
  for (const [name, value] of Object.entries(vars)) {
    el.style.setProperty(name, value);
  }
}

export function styleAttrFromWidgetStyle(style: WidgetStyle): string {
  const vars = widgetStyleCssVars(style);
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}
