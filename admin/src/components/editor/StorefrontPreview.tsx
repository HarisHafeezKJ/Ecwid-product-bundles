import { bundleLineSale, formatMoney } from '@pb/shared';
import { mixCtaLabel } from '@pb/shared';
import { useProductMap } from '../../hooks/useProducts';
import type { OfferDraft } from './editor-draft';

interface StorefrontPreviewProps {
  draft: OfferDraft;
}

function cssVars(style: OfferDraft['widgetStyle']): React.CSSProperties {
  return {
    ['--pb-block-title-color' as string]: style.blockTitleColor ?? '#111827',
    ['--pb-block-title-size' as string]: `${style.blockTitleSize ?? 18}px`,
    ['--pb-card-bg' as string]: style.offerCardBg ?? '#fff',
    ['--pb-card-border' as string]: style.offerCardBorder ?? '#e5e7eb',
    ['--pb-card-selected-bg' as string]: style.offerCardSelectedBg ?? '#f0fdf4',
    ['--pb-card-selected-border' as string]: style.offerCardSelectedBorder ?? '#22c55e',
    ['--pb-title-color' as string]: style.offerTitleColor ?? '#111827',
    ['--pb-price-color' as string]: style.priceColor ?? '#111827',
    ['--pb-cta-bg' as string]: style.ctaBg ?? '#111827',
    ['--pb-cta-color' as string]: style.ctaColor ?? '#fff',
    ['--pb-mix-card-bg' as string]: style.mixCardBg ?? '#fff',
    ['--pb-mix-summary-bg' as string]: style.mixSummaryBg ?? '#f9fafb',
  };
}

export default function StorefrontPreview({ draft }: StorefrontPreviewProps) {
  const style = draft.widgetStyle;
  const vars = cssVars(style);
  const bundleItemIds =
    draft.ruleType === 'FIXED_BUNDLE' ? draft.items.components.map((item) => item.productId) : [];
  const bundleProductMap = useProductMap(bundleItemIds);

  if (draft.ruleType === 'VOLUME_DISCOUNT') {
    const tiers = draft.volumeTiers.tiers;
    return (
      <div style={{ padding: 16, ...vars, fontFamily: 'var(--pb-font)' }}>
        <h3 style={{ margin: '0 0 12px', color: 'var(--pb-block-title-color)', fontSize: 'var(--pb-block-title-size)' }}>
          {style.blockTitle}
        </h3>
        <div style={{ display: 'flex', flexDirection: draft.layout === 'HORIZONTAL' ? 'row' : 'column', gap: 10 }}>
          {tiers.map((tier, i) => (
            <label
              key={i}
              style={{
                display: 'block',
                padding: 12,
                border: `2px solid ${i === 0 ? 'var(--pb-card-selected-border)' : 'var(--pb-card-border)'}`,
                background: i === 0 ? 'var(--pb-card-selected-bg)' : 'var(--pb-card-bg)',
                borderRadius: 10,
                flex: 1,
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--pb-title-color)' }}>{tier.title}</div>
              <div style={{ color: 'var(--pb-price-color)', marginTop: 4 }}>
                Buy {tier.qty} · {tier.discountValue}
                {tier.discountType === 'PERCENTAGE' ? '% off' : ''}
              </div>
            </label>
          ))}
        </div>
        <button
          type="button"
          style={{
            marginTop: 12,
            width: '100%',
            padding: '10px 14px',
            background: 'var(--pb-cta-bg)',
            color: 'var(--pb-cta-color)',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {style.addToCartText}
        </button>
      </div>
    );
  }

  if (draft.ruleType === 'FIXED_BUNDLE') {
    const items = draft.items.components;
    const productMap = bundleProductMap;
    const original = items.reduce((sum, item) => sum + (item.price ?? 19.99) * (item.minQuantity ?? 1), 0);
    const discounted = items.reduce(
      (sum, item) =>
        sum +
        bundleLineSale(item.price ?? 19.99, draft.discountType, draft.discountValue) *
          (item.minQuantity ?? 1),
      0,
    );
    return (
      <div style={{ padding: 16, ...vars, fontFamily: 'var(--pb-font)' }}>
        <h3 style={{ margin: '0 0 12px', color: 'var(--pb-block-title-color)', fontSize: 'var(--pb-block-title-size)' }}>
          {style.blockTitle}
        </h3>
        {items.map((item, i) => {
          const imageUrl = item.imageUrl ?? productMap[item.productId]?.imageUrl;
          return (
          <div key={item.productId} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
              />
            ) : (
              <div style={{ width: 48, height: 48, background: '#f1f5f9', borderRadius: 8 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: style.productTitleColor }}>
                {item.name ?? productMap[item.productId]?.name ?? `Product ${i + 1}`}
              </div>
              <div style={{ fontSize: 12, color: style.productQtyColor }}>Qty {item.minQuantity ?? 1}</div>
            </div>
            <div style={{ color: style.productPriceColor }}>{formatMoney(item.price ?? 19.99)}</div>
          </div>
          );
        })}
        <div style={{ marginTop: 8, fontWeight: 600, color: style.buyAllColor }}>
          {style.buyAllAtText} {formatMoney(discounted)}{' '}
          <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontWeight: 400 }}>
            {formatMoney(original)}
          </span>
        </div>
        <button
          type="button"
          style={{
            marginTop: 12,
            width: '100%',
            padding: '10px 14px',
            background: 'var(--pb-cta-bg)',
            color: 'var(--pb-cta-color)',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {style.addToCartText}
        </button>
      </div>
    );
  }

  if (draft.ruleType === 'MIX_AND_MATCH') {
    const required = draft.volumeTiers.tiers[0]?.qty ?? 2;
    const pool = draft.items.components;
    return (
      <div style={{ padding: 16, ...vars, fontFamily: 'var(--pb-font)' }}>
        <h3 style={{ margin: '0 0 12px', color: 'var(--pb-block-title-color)', fontSize: 'var(--pb-block-title-size)' }}>
          {style.blockTitle}
        </h3>
        <div className="product-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {pool.slice(0, 4).map((item) => (
            <div
              key={item.productId}
              style={{
                border: `1px solid ${style.mixCardBorder ?? '#e5e7eb'}`,
                background: 'var(--pb-mix-card-bg)',
                borderRadius: 8,
                padding: 8,
              }}
            >
              <div style={{ height: 60, background: '#f1f5f9', borderRadius: 6 }} />
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{item.name ?? 'Product'}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: 'var(--pb-mix-summary-bg)',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {style.summaryTitle ?? 'Your selection'}
        </div>
        <button
          type="button"
          style={{
            marginTop: 12,
            width: '100%',
            padding: '10px 14px',
            background: 'var(--pb-cta-bg)',
            color: 'var(--pb-cta-color)',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {mixCtaLabel(style.qtyPromptText, required)}
        </button>
      </div>
    );
  }

  const suggested = draft.suggestedProductIds.slice(0, 3);
  return (
    <div style={{ padding: 16, ...vars, fontFamily: 'var(--pb-font)' }}>
      <h3 style={{ margin: '0 0 12px', color: 'var(--pb-block-title-color)', fontSize: 'var(--pb-block-title-size)' }}>
        {style.blockTitle}
      </h3>
      {suggested.map((id, i) => (
        <div
          key={id}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: 10,
            border: '1px solid var(--pb-card-border)',
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <div style={{ width: 48, height: 48, background: '#f1f5f9', borderRadius: 8 }} />
          <div style={{ flex: 1, fontWeight: 600 }}>Suggested product {i + 1}</div>
          <button
            type="button"
            style={{
              padding: '6px 10px',
              background: 'var(--pb-cta-bg)',
              color: 'var(--pb-cta-color)',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {style.addToCartText}
          </button>
        </div>
      ))}
      <button
        type="button"
        style={{
          marginTop: 8,
          width: '100%',
          padding: '10px 14px',
          background: style.ctaSuccessBg ?? '#16a34a',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 600,
        }}
      >
        Add 2 items &amp; checkout →
      </button>
    </div>
  );
}
