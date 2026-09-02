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

/** Reject values that could break out of a `style=""` attribute or inject CSS. */
const UNSAFE_CSS_VALUE = /[<>"'`\\]|(?:url|expression|javascript)\s*\(/i;

function isColorKey(key: string): boolean {
  return COLOR_KEYS.has(key) || key.endsWith('Color') || key.endsWith('Bg') || key.endsWith('Border');
}

function sanitizeCssColor(raw: string): string | undefined {
  const value = raw.trim();
  if (!value || UNSAFE_CSS_VALUE.test(value)) return undefined;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return value;
  if (/^(rgb|rgba|hsl|hsla)\(\s*[\d.%\s,/]+\)$/i.test(value)) return value;
  if (/^[a-z][a-z0-9-]*$/i.test(value)) return value;
  return undefined;
}

export function widgetStyleCssVars(style: WidgetStyle, prefix = 'pb'): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, raw] of Object.entries(style)) {
    if (raw == null || raw === '') continue;
    const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const name = `--${prefix}-${kebab}`;
    if (SIZE_KEYS.has(key)) {
      const n = Number(raw);
      if (!Number.isNaN(n) && Number.isFinite(n)) vars[name] = `${n}px`;
      continue;
    }
    if (WIDTH_PERCENT_KEYS.has(key)) {
      const n = Number(raw);
      if (!Number.isNaN(n) && Number.isFinite(n)) vars[name] = String(Math.min(100, Math.max(0, n)));
      continue;
    }
    if (isColorKey(key)) {
      const color = sanitizeCssColor(String(raw));
      if (color) vars[name] = color;
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
  const setColor = (name: string, value: string) => {
    const color = sanitizeCssColor(value);
    if (color) root.style.setProperty(name, color);
  };

  setColor('--pb-cta-bg', cs.backgroundColor);
  setColor('--pb-cta-color', cs.color);
  if (cs.borderRadius) root.style.setProperty('--pb-cta-radius', cs.borderRadius);
  if (cs.fontSize) root.style.setProperty('--pb-cta-size', cs.fontSize);
  if (cs.fontWeight) root.style.setProperty('--pb-cta-font-weight', cs.fontWeight);
  if (cs.border) root.style.setProperty('--pb-cta-border', cs.border);
  if (cs.padding) root.style.setProperty('--pb-cta-padding', cs.padding);
  const minH = cs.minHeight !== '0px' ? cs.minHeight : cs.height;
  if (minH && minH !== '0px') root.style.setProperty('--pb-cta-min-height', minH);
  root.classList.add('pb-widget--native-atc');
}

export function styleAttrFromWidgetStyle(style: WidgetStyle): string {
  const vars = widgetStyleCssVars(style);
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}
