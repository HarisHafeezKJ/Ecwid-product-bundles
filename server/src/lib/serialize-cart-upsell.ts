import type { CartUpsellView, SerializedCartUpsellOffer } from '@pb/shared';
import { mapVariants, normalizeWidgetStyleForStorefront } from './serialize-widget-view.js';

function copyText(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length ? text : undefined;
}

/**
 * Cart upsell shares the storefront serialization contract with product widgets so
 * variant labels and admin-side style keys resolve the same way in both surfaces.
 */
export function serializeCartUpsellOffer(view: CartUpsellView): SerializedCartUpsellOffer {
  const style = normalizeWidgetStyleForStorefront(view.rule.widgetStyle);

  return {
    ruleId: view.rule.id,
    blockTitle: copyText(style.blockTitle),
    addToCartText: copyText(style.addToCartText),
    buyAllTagText: copyText(style.buyAllTagText),
    checkoutCtaLabel: copyText(view.checkoutCtaLabel) ?? copyText(style.checkoutCtaLabel),
    widgetStyle: style,
    suggested: view.suggested.map((product) => ({
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      price: product.price,
      inStock: product.inStock,
      variants: mapVariants(product),
    })),
  };
}
