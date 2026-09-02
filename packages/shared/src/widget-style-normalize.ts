import type { WidgetStyle } from './types.js';

/** Map admin widget style keys to storefront field names used by CSS and markup. */
export function normalizeWidgetStyleForStorefront(style: WidgetStyle | undefined): WidgetStyle {
  const s = { ...(style ?? {}) } as Record<string, string | number | boolean | undefined>;

  const alias = (from: string, to: string) => {
    if (s[from] != null && s[to] == null) s[to] = s[from];
  };

  alias('offerCardSelectedBg', 'offerSelectedBg');
  alias('offerCardSelectedBorder', 'offerSelectedBorder');
  alias('buyAllColor', 'buyAllAtColor');
  alias('buyAllSize', 'buyAllAtSize');
  alias('buyAllPriceColor', 'buyAllAtPriceColor');
  alias('buyAllPriceSize', 'buyAllAtPriceSize');
  alias('buyAllTagColor', 'buyAllAtTagColor');
  alias('buyAllTagSize', 'buyAllAtTagSize');
  alias('variationColor', 'variantSelectColor');
  alias('qtyPromptText', 'mixCtaSelectMore');
  alias('addToCartText', 'mixCtaAdd');

  alias('offerCardBg', 'upsellCardBg');
  alias('offerCardBorder', 'upsellCardBorder');
  alias('offerCardSelectedBg', 'upsellSelectedBg');
  alias('offerCardSelectedBorder', 'upsellSelectedBorder');
  alias('productTitleColor', 'upsellTitleColor');
  alias('productTitleSize', 'upsellTitleSize');
  alias('productPriceColor', 'upsellPriceColor');
  alias('productPriceSize', 'upsellPriceSize');
  alias('ctaBg', 'checkoutCtaBg');
  alias('ctaColor', 'checkoutCtaColor');

  const divider = s.productDivider ?? s.dividerStyle;
  if (divider != null && s.divider == null) s.divider = divider;

  return s as WidgetStyle;
}
