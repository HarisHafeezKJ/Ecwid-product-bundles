import type { WidgetStyle } from '../types';
import { widgetStyleCssVars } from '@pb/shared';

export { widgetStyleCssVars, styleAttrFromWidgetStyle } from '@pb/shared';

/** Reject values that could break out of a `style=""` attribute or inject CSS. */
const UNSAFE_CSS_VALUE = /[<>"'`\\]|(?:url|expression|javascript)\s*\(/i;

function sanitizeCssColor(raw: string): string | undefined {
  const value = raw.trim();
  if (!value || UNSAFE_CSS_VALUE.test(value)) return undefined;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return value;
  if (/^(rgb|rgba|hsl|hsla)\(\s*[\d.%\s,/]+\)$/i.test(value)) return value;
  if (/^[a-z][a-z0-9-]*$/i.test(value)) return value;
  return undefined;
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

/** Match bundle CTA to the store's native add-to-cart button when admin has not set CTA colors. */
export function mirrorNativeAtcTheme(root: HTMLElement, style?: WidgetStyle): void {
  if (style?.ctaBg?.trim() || style?.ctaColor?.trim()) return;

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
