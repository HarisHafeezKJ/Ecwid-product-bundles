import type { CartUpsellOffer, CartUpsellProduct, WidgetStyle } from '../types';
import { escapeHtml, formatMoney, replaceTokens } from '../utils';
import { styleAttrFromWidgetStyle } from '../widgets/widget-style-css';

export function cartUpsellBlockMarkup(
  offer: CartUpsellOffer,
  selected: Set<string>,
  expanded: Set<string>,
  variantMap: Record<string, string>,
  currency = 'USD',
): string {
  const style = offer.widgetStyle ?? {};
  const styleAttr = styleAttrFromWidgetStyle(style as WidgetStyle);
  const cards = offer.suggested
    .map((p) => upsellProductCard(p, offer, selected, expanded, variantMap, currency))
    .join('');

  const selectedCount = offer.suggested.filter((p) => selected.has(p.productId)).length;
  const cta = checkoutCtaLabel(style as WidgetStyle, selectedCount);

  return `<div class="pb-upsell" data-rule-id="${escapeHtml(offer.ruleId)}" style="${styleAttr}">
    <h3 class="pb-upsell__title">${escapeHtml(offer.blockTitle ?? style.blockTitle ?? 'Customers also bought')}</h3>
    <div class="pb-upsell__grid">${cards}</div>
    <button type="button" class="pb-upsell__checkout" data-pb-upsell-checkout${selectedCount === 0 ? ' disabled' : ''}>${escapeHtml(cta)}</button>
    <p class="pb-upsell__error" data-pb-upsell-error hidden></p>
  </div>`;
}

function upsellProductCard(
  product: CartUpsellProduct,
  offer: CartUpsellOffer,
  selected: Set<string>,
  expanded: Set<string>,
  variantMap: Record<string, string>,
  currency: string,
): string {
  const isSelected = selected.has(product.productId);
  const hasVariants = (product.variants?.length ?? 0) > 1;
  const showVariants = hasVariants && (expanded.has(product.productId) || isSelected);
  const img = product.imageUrl
    ? `<img class="pb-upsell__img" src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
    : '<div class="pb-upsell__img" aria-hidden="true"></div>';

  const variantSelect = showVariants
    ? `<select class="pb-upsell__variant" data-pb-upsell-variant data-product-id="${escapeHtml(product.productId)}">
        ${(product.variants ?? [])
          .map(
            (v) =>
              `<option value="${escapeHtml(v.id)}"${variantMap[product.productId] === v.id ? ' selected' : ''}${v.inStock ? '' : ' disabled'}>${escapeHtml(v.label)}</option>`,
          )
          .join('')}
      </select>`
    : '';

  const tag = offer.buyAllTagText ?? 'Selected ✓';

  return `<article class="pb-upsell__card${isSelected ? ' pb-upsell__card--selected' : ''}" data-product-id="${escapeHtml(product.productId)}" data-pb-upsell-card>
    ${img}
    <p class="pb-upsell__name">${escapeHtml(product.name)}</p>
    <p class="pb-upsell__price">${formatMoney(product.price, currency)}</p>
    ${variantSelect}
    <button type="button" class="pb-upsell__select-btn" data-pb-upsell-toggle>${escapeHtml(isSelected ? tag : offer.addToCartText ?? 'Select')}</button>
  </article>`;
}

export function checkoutCtaLabel(style: WidgetStyle, count: number): string {
  if (count <= 0) return style.checkoutCtaLabel ?? 'Select items to checkout';
  const template = style.checkoutCtaLabel ?? 'Add {{COUNT}} items & checkout →';
  return replaceTokens(template, { COUNT: count });
}
