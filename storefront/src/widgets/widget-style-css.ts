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
  'ctaSize',
  'ctaRadius',
  'upsellTitleSize',
  'upsellPriceSize',
]);

const WIDTH_PERCENT_KEYS = new Set(['ctaWidth', 'variationsWidth']);

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
  'ctaBg',
  'ctaColor',
  'ctaActiveBg',
  'ctaSuccessBg',
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
    if (WIDTH_PERCENT_KEYS.has(key)) {
      const n = Number(raw);
      if (!Number.isNaN(n)) vars[name] = String(n);
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

const NATIVE_ATC_SELECTORS = [
  '.product-details__action-panel .form-control__button',
  '.details-product-purchase .form-control__button',
  '.details-product-purchase button[type="button"]',
  '[data-hook="product-add-to-cart"]',
].join(', ');

/** Match bundle CTA to the store's native add-to-cart button on Instant Site / legacy themes. */
export function mirrorNativeAtcTheme(root: HTMLElement): void {
  const native = document.querySelector<HTMLElement>(NATIVE_ATC_SELECTORS);
  if (!native) return;

  const cs = getComputedStyle(native);
  const set = (name: string, value: string) => {
    if (value) root.style.setProperty(name, value);
  };

  set('--pb-cta-bg', cs.backgroundColor);
  set('--pb-cta-color', cs.color);
  set('--pb-cta-radius', cs.borderRadius);
  set('--pb-cta-size', cs.fontSize);
  set('--pb-cta-font-weight', cs.fontWeight);
  set('--pb-cta-border', cs.border);
  set('--pb-cta-padding', cs.padding);
  set('--pb-cta-min-height', cs.minHeight !== '0px' ? cs.minHeight : cs.height);
  root.classList.add('pb-widget--native-atc');
}

export function styleAttrFromWidgetStyle(style: WidgetStyle): string {
  const vars = widgetStyleCssVars(style);
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}
