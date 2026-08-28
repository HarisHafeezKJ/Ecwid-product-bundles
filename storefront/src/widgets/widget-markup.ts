import type {
  StorefrontWidgetView,
  VolumeTierView,
  WidgetProductItem,
  WidgetStyle,
} from '../types';
import { escapeHtml, formatMoney, replaceTokens } from '../utils';
import { styleAttrFromWidgetStyle } from './widget-style-css';

function productImage(item: WidgetProductItem): string {
  if (!item.imageUrl) {
    return '<div class="pb-product__img pb-product__img--empty" aria-hidden="true"></div>';
  }
  return `<img class="pb-product__img" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" />`;
}

function variantSelect(
  item: WidgetProductItem,
  selectName: string,
  unitIndex?: number,
  locked = false,
): string {
  const variants = item.variants ?? [];
  if (variants.length <= 1) return '';
  const suffix = unitIndex != null ? `-u${unitIndex}` : '';
  const id = `pb-var-${item.productId}${suffix}`;
  const disabled = locked ? ' disabled' : '';
  const options = variants
    .map((v) => {
      const label = v.inStock
        ? escapeHtml(v.label)
        : `${escapeHtml(v.label)} (out of stock)`;
      return `<option value="${escapeHtml(v.id)}"${v.inStock ? '' : ' disabled'}>${label}</option>`;
    })
    .join('');
  return `<label class="pb-variant" for="${id}">
    <select class="pb-variant__select" id="${id}" name="${escapeHtml(selectName)}" data-product-id="${escapeHtml(item.productId)}" data-unit="${unitIndex ?? 0}"${disabled}>${options}</select>
  </label>`;
}

export function volumeOfferMarkup(view: StorefrontWidgetView, selectedQty: number): string {
  const style = view.widgetStyle;
  const tiers = view.volumeTiers ?? [];
  const layout = view.layout ?? style.layout ?? 'VERTICAL';
  const currency = view.currency ?? 'USD';
  const styleAttr = styleAttrFromWidgetStyle(style);

  const cards = tiers
    .map((tier) => volumeTierCard(tier, selectedQty === tier.qty, currency))
    .join('');

  return `<section class="pb-widget pb-volume pb-volume--${layout.toLowerCase()}" data-rule-id="${escapeHtml(view.ruleId)}" style="${styleAttr}">
    <h3 class="pb-widget__title">${escapeHtml(style.blockTitle ?? 'Quantity offers')}</h3>
    <div class="pb-volume__tiers" role="radiogroup" aria-label="Quantity offers">${cards}</div>
    <div class="pb-volume__variants" data-pb-volume-variants hidden></div>
    <div class="pb-volume__summary">
      <span class="pb-volume__summary-buy">${escapeHtml(style.summaryBuy ?? 'Buy')}</span>
      <span class="pb-volume__summary-save">${escapeHtml(style.summarySave ?? 'Save')}</span>
    </div>
    <button type="button" class="pb-btn pb-btn--atc" data-pb-atc>${escapeHtml(style.addToCartText ?? 'Add to cart')}</button>
    <p class="pb-widget__error" data-pb-error hidden></p>
  </section>`;
}

function volumeTierCard(tier: VolumeTierView, selected: boolean, currency: string): string {
  const price = tier.discountedUnitPrice ?? tier.unitPrice ?? 0;
  const original = tier.unitPrice;
  const showOriginal = original != null && price < original;
  const img = tier.imageUrl
    ? `<img class="pb-volume__tier-img" src="${escapeHtml(tier.imageUrl)}" alt="" style="width:${tier.imageSize ?? 48}px;height:${tier.imageSize ?? 48}px;border-radius:${tier.imageRadius ?? 8}px" />`
    : '';
  return `<label class="pb-volume__tier${selected ? ' pb-volume__tier--selected' : ''}">
    <input type="radio" name="pb-volume-qty" value="${tier.qty}"${selected ? ' checked' : ''} />
    ${img}
    <span class="pb-volume__tier-title">${escapeHtml(tier.title ?? `${tier.qty} items`)}</span>
    <span class="pb-volume__tier-price">${formatMoney(price, currency)}</span>
    ${showOriginal ? `<span class="pb-volume__tier-original">${formatMoney(original, currency)}</span>` : ''}
  </label>`;
}

export function fixedBundleMarkup(view: StorefrontWidgetView): string {
  const style = view.widgetStyle;
  const currency = view.currency ?? 'USD';
  const styleAttr = styleAttrFromWidgetStyle(style);
  const divider = style.divider ?? 'PLUS';
  const rows = view.items
    .map((item, index) => bundleProductRow(item, style, currency, index, view.items.length, divider))
    .join('');

  return `<section class="pb-widget pb-bundle" data-rule-id="${escapeHtml(view.ruleId)}" style="${styleAttr}">
    <h3 class="pb-widget__title">${escapeHtml(style.blockTitle ?? 'Bundle offer')}</h3>
    <div class="pb-bundle__products">${rows}</div>
    <div class="pb-bundle__summary">
      <span class="pb-bundle__buy-all">${escapeHtml(style.buyAllAtText ?? 'Buy all at')}</span>
      <span class="pb-bundle__price">${formatMoney(view.discounted, currency)}</span>
      ${
        view.original != null && view.discounted != null && view.original > view.discounted
          ? `<span class="pb-bundle__original">${formatMoney(view.original, currency)}</span>`
          : ''
      }
      ${
        view.savings != null && view.savings > 0
          ? `<span class="pb-bundle__tag">${escapeHtml(style.buyAllTagText ?? 'Save')} ${formatMoney(view.savings, currency)}</span>`
          : ''
      }
    </div>
    <button type="button" class="pb-btn pb-btn--atc" data-pb-atc>${escapeHtml(style.addToCartText ?? 'Add bundle to cart')}</button>
    <p class="pb-widget__error" data-pb-error hidden></p>
  </section>`;
}

function bundleProductRow(
  item: WidgetProductItem,
  style: WidgetStyle,
  currency: string,
  index: number,
  total: number,
  divider: string,
): string {
  const price = item.discountedPrice ?? item.price;
  const showUnits =
    item.chooseVariationPerItem && item.minQuantity > 1 && (item.variants?.length ?? 0) > 1;
  const variantHtml = showUnits
    ? Array.from({ length: item.minQuantity }, (_, u) =>
        variantSelect(item, `pb-bundle-var-${item.productId}`, u, !!item.adminLocksVariant),
      ).join('')
    : variantSelect(item, `pb-bundle-var-${item.productId}`, undefined, !!item.adminLocksVariant);

  const dividerHtml =
    index < total - 1 ? `<div class="pb-bundle__divider pb-bundle__divider--${divider.toLowerCase()}" aria-hidden="true"></div>` : '';

  return `<article class="pb-product" data-product-id="${escapeHtml(item.productId)}">
    ${productImage(item)}
    <div class="pb-product__body">
      <h4 class="pb-product__title">${escapeHtml(item.name)}</h4>
      <span class="pb-product__qty">× ${item.minQuantity}</span>
      <span class="pb-product__price">${formatMoney(price, currency)}</span>
      ${variantHtml}
    </div>
  </article>${dividerHtml}`;
}

export function mixMatchMarkup(view: StorefrontWidgetView, selectedQty: number): string {
  const style = view.widgetStyle;
  const currency = view.currency ?? 'USD';
  const required = view.mixRequiredCount ?? 1;
  const styleAttr = styleAttrFromWidgetStyle(style);
  const cta = mixCtaLabel(style, selectedQty, required);

  const rows = view.items
    .map((item) => mixProductRow(item, style, currency))
    .join('');

  return `<section class="pb-widget pb-mix" data-rule-id="${escapeHtml(view.ruleId)}" style="${styleAttr}">
    <h3 class="pb-widget__title">${escapeHtml(style.blockTitle ?? 'Mix & Match')}</h3>
    <div class="pb-mix__products">${rows}</div>
    <div class="pb-mix__summary">
      <span class="pb-mix__total">${formatMoney(view.mixDiscounted, currency)}</span>
      ${
        view.mixOriginal != null && view.mixDiscounted != null && view.mixOriginal > view.mixDiscounted
          ? `<span class="pb-mix__original">${formatMoney(view.mixOriginal, currency)}</span>`
          : ''
      }
    </div>
    <button type="button" class="pb-btn pb-btn--atc" data-pb-atc${selectedQty < required ? ' disabled' : ''}>${escapeHtml(cta)}</button>
    <p class="pb-widget__error" data-pb-error hidden></p>
  </section>`;
}

function mixProductRow(item: WidgetProductItem, _style: WidgetStyle, currency: string): string {
  return `<article class="pb-product pb-mix__product" data-product-id="${escapeHtml(item.productId)}">
    ${productImage(item)}
    <div class="pb-product__body">
      <h4 class="pb-product__title">${escapeHtml(item.name)}</h4>
      <span class="pb-product__price">${formatMoney(item.price, currency)}</span>
      ${variantSelect(item, `pb-mix-var-${item.productId}`)}
      <div class="pb-qty-stepper" data-pb-qty-stepper>
        <button type="button" class="pb-qty-stepper__btn" data-pb-qty-dec aria-label="Decrease quantity">−</button>
        <input type="number" class="pb-qty-stepper__input" data-pb-qty-input value="0" min="0" aria-label="Quantity" />
        <button type="button" class="pb-qty-stepper__btn" data-pb-qty-inc aria-label="Increase quantity">+</button>
      </div>
    </div>
  </article>`;
}

export function mixCtaLabel(style: WidgetStyle, selectedQty: number, required: number): string {
  if (selectedQty >= required) {
    return style.mixCtaAdd ?? style.addToCartText ?? 'Add to cart';
  }
  const remaining = Math.max(required - selectedQty, 0);
  const template = style.mixCtaSelectMore ?? 'Select {{COUNT}} more';
  return replaceTokens(template, { COUNT: remaining });
}

export function volumeVariantUnitsMarkup(
  item: WidgetProductItem,
  qty: number,
  style: WidgetStyle,
): string {
  if (!style && qty <= 1) return '';
  const units = Array.from({ length: qty }, (_, u) =>
    variantSelect(item, `pb-volume-var-${item.productId}`, u),
  ).join('');
  return units ? `<div class="pb-volume__variant-units">${units}</div>` : '';
}

export function widgetErrorMarkup(message: string): string {
  return `<div class="pb-widget pb-widget--error"><p>${escapeHtml(message)}</p></div>`;
}

export function widgetEmptyMarkup(): string {
  return '';
}
