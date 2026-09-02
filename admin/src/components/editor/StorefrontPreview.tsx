import { useMemo, type CSSProperties } from 'react';
import {
  addToCartText,
  blockTitleText,
  bundleLineSale,
  bundleUsesPerUnitVariantPickers,
  bundleVariantFieldLabel,
  bundleVariantPickerCount,
  buyAllAtText,
  formatMoney,
  mixCtaLabel,
  normalizeWidgetStyleForStorefront,
  summaryBuyText,
  summarySaveText,
  upsellSelectedText,
  widgetStyleCssVars,
  type BundleItem,
  type CatalogProduct,
  type CatalogVariant,
  type ProductDivider,
  type WidgetStyle,
} from '@pb/shared';
import { useProductMap } from '../../hooks/useProducts';
import type { OfferDraft } from './editor-draft';

interface StorefrontPreviewProps {
  draft: OfferDraft;
}

function previewStyleVars(style: WidgetStyle): CSSProperties {
  const normalized = normalizeWidgetStyleForStorefront(style);
  return widgetStyleCssVars(normalized) as CSSProperties;
}

function PreviewShell({ children }: { children: React.ReactNode }) {
  return <div className="pb-product-bundles">{children}</div>;
}

function ProductImage({ src, alt }: { src?: string; alt: string }) {
  if (src) {
    return <img className="pb-product__img" src={src} alt={alt} width={72} height={72} loading="lazy" />;
  }
  return <div className="pb-product__img pb-product__img--empty" aria-hidden="true" />;
}

function BundleDivider({ divider }: { divider: ProductDivider }) {
  return (
    <div
      className={`pb-bundle__divider pb-bundle__divider--${divider.toLowerCase()}`}
      aria-hidden="true"
    />
  );
}

function variantOptionLabel(variant: CatalogVariant): string {
  const parts = Object.values(variant.options ?? {}).filter(Boolean);
  return parts.join(' / ') || variant.id;
}

function BundleVariantFields({
  item,
  product,
  style,
}: {
  item: BundleItem;
  product?: CatalogProduct;
  style: WidgetStyle;
}) {
  const variants = product?.variants ?? [];
  const pickerItem = { ...item, variants };
  const pickerCount = bundleVariantPickerCount(pickerItem);
  if (pickerCount === 0) return null;

  const perUnit = bundleUsesPerUnitVariantPickers(pickerItem);
  const locked = !!item.adminLocksVariant;
  const variantLabel = typeof style.variantLabel === 'string' ? style.variantLabel : 'Variation';
  const defaultId = item.defaultVariantId ?? variants.find((v) => v.inStock)?.id ?? variants[0]?.id;

  return (
    <div className="pb-product__variants">
      {Array.from({ length: pickerCount }, (_, u) => {
        const unitIndex = perUnit ? u : 0;
        const fieldLabel = bundleVariantFieldLabel(variantLabel, unitIndex, pickerCount);
        return (
          <label key={u} className="pb-variant" htmlFor={`pb-preview-var-${item.productId}-${u}`}>
            <span className="pb-variant__label">{fieldLabel}</span>
            <select
              className="pb-variant__select"
              id={`pb-preview-var-${item.productId}-${u}`}
              defaultValue={defaultId}
              disabled={locked}
              aria-disabled={locked}
            >
              {variants.map((variant) => {
                const label = variantOptionLabel(variant);
                return (
                  <option key={variant.id} value={variant.id} disabled={!variant.inStock}>
                    {variant.inStock ? label : `${label} (out of stock)`}
                  </option>
                );
              })}
            </select>
          </label>
        );
      })}
    </div>
  );
}

export default function StorefrontPreview({ draft }: StorefrontPreviewProps) {
  const rawStyle = draft.widgetStyle;
  const style = useMemo(() => normalizeWidgetStyleForStorefront(rawStyle), [rawStyle]);
  const vars = useMemo(() => previewStyleVars(rawStyle), [rawStyle]);
  const bundleItemIds =
    draft.ruleType === 'FIXED_BUNDLE' ? draft.items.components.map((item) => item.productId) : [];
  const mixItemIds =
    draft.ruleType === 'MIX_AND_MATCH' ? draft.items.components.map((item) => item.productId) : [];
  const upsellItemIds = draft.ruleType === 'CART_UPSELL' ? draft.suggestedProductIds.slice(0, 4) : [];
  const bundleProductMap = useProductMap(bundleItemIds);
  const mixProductMap = useProductMap(mixItemIds);
  const upsellProductMap = useProductMap(upsellItemIds);

  if (draft.ruleType === 'VOLUME_DISCOUNT') {
    const tiers = draft.volumeTiers.tiers;
    const layout = draft.layout ?? style.layout ?? 'VERTICAL';
    return (
      <PreviewShell>
        <section
          className={`pb-widget pb-volume pb-volume--${layout.toLowerCase()}`}
          style={vars}
        >
          <h3 className="pb-widget__title">{blockTitleText(style, 'Quantity offers')}</h3>
          <div className="pb-volume__tiers" role="radiogroup" aria-label="Quantity offers">
            {tiers.map((tier, i) => (
              <label
                key={i}
                className={`pb-volume__tier${i === 0 ? ' pb-volume__tier--selected' : ''}`}
              >
                <input type="radio" name="pb-preview-volume-qty" defaultChecked={i === 0} readOnly />
                <span className="pb-volume__tier-title">{tier.title ?? `${tier.qty} items`}</span>
                <span className="pb-volume__tier-price">
                  Buy {tier.qty} · {tier.discountValue}
                  {tier.discountType === 'PERCENTAGE' ? '% off' : ''}
                </span>
              </label>
            ))}
          </div>
          <div className="pb-volume__summary">
            <span className="pb-volume__summary-buy">{summaryBuyText(style)}</span>
            <span className="pb-volume__summary-save">{summarySaveText(style)}</span>
          </div>
          <button type="button" className="pb-btn pb-btn--atc">
            {addToCartText(style)}
          </button>
        </section>
      </PreviewShell>
    );
  }

  if (draft.ruleType === 'FIXED_BUNDLE') {
    const items = draft.items.components;
    const divider = (style.divider ?? style.productDivider ?? 'PLUS_LINE') as ProductDivider;
    const original = items.reduce(
      (sum, item) => sum + (item.price ?? productMapPrice(bundleProductMap, item)) * (item.minQuantity ?? 1),
      0,
    );
    const discounted = items.reduce(
      (sum, item) => {
        const price = item.price ?? productMapPrice(bundleProductMap, item);
        return sum + bundleLineSale(price, draft.discountType, draft.discountValue) * (item.minQuantity ?? 1);
      },
      0,
    );
    const savings = Math.max(0, original - discounted);

    return (
      <PreviewShell>
        <section className="pb-widget pb-bundle" style={vars}>
          <h3 className="pb-widget__title">{blockTitleText(style, 'Frequently Bought Together')}</h3>
          <div className="pb-bundle__products">
            {items.map((item, index) => {
              const product = bundleProductMap[item.productId];
              const name = item.name ?? product?.name ?? `Product ${index + 1}`;
              const imageUrl = item.imageUrl ?? product?.imageUrl;
              const price = item.price ?? product?.price ?? 19.99;
              const linePrice = bundleLineSale(price, draft.discountType, draft.discountValue);
              return (
                <div key={item.productId}>
                  <article className="pb-product">
                    <ProductImage src={imageUrl} alt={name} />
                    <div className="pb-product__body">
                      <h4 className="pb-product__title">{name}</h4>
                      <span className="pb-product__qty">× {item.minQuantity ?? 1}</span>
                      <span className="pb-product__price">{formatMoney(linePrice)}</span>
                      <BundleVariantFields item={item} product={product} style={style} />
                    </div>
                  </article>
                  {index < items.length - 1 ? <BundleDivider divider={divider} /> : null}
                </div>
              );
            })}
          </div>
          <div className="pb-bundle__summary">
            <span className="pb-bundle__buy-all">{buyAllAtText(style)}</span>
            <span className="pb-bundle__price">{formatMoney(discounted)}</span>
            {original > discounted ? (
              <span className="pb-bundle__original">{formatMoney(original)}</span>
            ) : null}
            {savings > 0 ? (
              <span className="pb-bundle__tag">
                {style.buyAllTagText ?? 'Save'} {formatMoney(savings)}
              </span>
            ) : null}
          </div>
          <button type="button" className="pb-btn pb-btn--atc">
            {addToCartText(style, 'Add bundle to cart')}
          </button>
        </section>
      </PreviewShell>
    );
  }

  if (draft.ruleType === 'MIX_AND_MATCH') {
    const required = draft.volumeTiers.tiers[0]?.qty ?? 2;
    const pool = draft.items.components;
    const previewSelected = 0;
    const mixOriginal = pool.slice(0, 2).reduce((sum, item) => sum + (item.price ?? 19.99), 0);
    const mixDiscounted = bundleLineSale(mixOriginal, draft.discountType, draft.discountValue);

    return (
      <PreviewShell>
        <section className="pb-widget pb-mix" style={vars}>
          <h3 className="pb-widget__title">{blockTitleText(style, 'Mix & Match')}</h3>
          <div className="pb-mix__products">
            {pool.slice(0, 4).map((item, index) => {
              const product = mixProductMap[item.productId];
              const name = item.name ?? product?.name ?? 'Product';
              const imageUrl = item.imageUrl ?? product?.imageUrl;
              const price = item.price ?? product?.price ?? 19.99;
              return (
                <article
                  key={item.productId}
                  className={`pb-product pb-mix__product${index === 0 ? ' pb-mix__product--selected' : ''}`}
                >
                  <ProductImage src={imageUrl} alt={name} />
                  <div className="pb-product__body">
                    <h4 className="pb-product__title">{name}</h4>
                    <span className="pb-product__price">{formatMoney(price)}</span>
                    <div className="pb-qty-stepper" aria-hidden="true">
                      <button type="button" className="pb-qty-stepper__btn" tabIndex={-1}>
                        −
                      </button>
                      <input
                        type="number"
                        className="pb-qty-stepper__input"
                        value={index === 0 ? 1 : 0}
                        readOnly
                        tabIndex={-1}
                      />
                      <button type="button" className="pb-qty-stepper__btn" tabIndex={-1}>
                        +
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="pb-mix__summary">
            <span className="pb-mix__total">{formatMoney(mixDiscounted)}</span>
            {mixOriginal > mixDiscounted ? (
              <span className="pb-mix__original">{formatMoney(mixOriginal)}</span>
            ) : null}
          </div>
          <button type="button" className="pb-btn pb-btn--atc" disabled={previewSelected < required}>
            {previewSelected >= required
              ? addToCartText(style)
              : mixCtaLabel(
                  asCopyField(style.mixCtaSelectMore) ?? asCopyField(style.qtyPromptText),
                  required - previewSelected,
                )}
          </button>
        </section>
      </PreviewShell>
    );
  }

  const suggested = draft.suggestedProductIds.slice(0, 3);
  const selectedCount = suggested.length > 0 ? 1 : 0;

  return (
    <PreviewShell>
      <div className="pb-upsell" style={vars}>
        <h3 className="pb-upsell__title">{blockTitleText(style, 'Customers also bought')}</h3>
        <div className="pb-upsell__grid">
          {suggested.map((id, i) => {
            const product = upsellProductMap[id];
            const name = product?.name ?? `Suggested product ${i + 1}`;
            const isSelected = i === 0;
            return (
              <article
                key={id}
                className={`pb-upsell__card${isSelected ? ' pb-upsell__card--selected' : ''}`}
              >
                {product?.imageUrl ? (
                  <img className="pb-upsell__img" src={product.imageUrl} alt={name} loading="lazy" />
                ) : (
                  <div className="pb-upsell__img" aria-hidden="true" />
                )}
                <p className="pb-upsell__name">{name}</p>
                <p className="pb-upsell__price">{formatMoney(product?.price ?? 19.99)}</p>
                <button type="button" className="pb-upsell__select-btn">
                  {isSelected ? upsellSelectedText(style) : addToCartText(style, 'Select')}
                </button>
              </article>
            );
          })}
        </div>
        <button type="button" className="pb-upsell__checkout" disabled={selectedCount === 0}>
          {selectedCount > 0
            ? `Add ${selectedCount} item${selectedCount === 1 ? '' : 's'} & checkout →`
            : 'Select items to checkout'}
        </button>
      </div>
    </PreviewShell>
  );
}

function asCopyField(value: string | number | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function productMapPrice(
  productMap: Record<string, { price?: number } | undefined>,
  item: { productId: string; price?: number },
): number {
  return item.price ?? productMap[item.productId]?.price ?? 19.99;
}
