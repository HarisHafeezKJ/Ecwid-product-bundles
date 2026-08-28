import type { OfferDraft } from './editor-draft';
import ProductSearchBar from './ProductSearchBar';
import type { WidgetStyle } from '@pb/shared';

interface EditorDetailsProps {
  draft: OfferDraft;
  onChange: (patch: Partial<OfferDraft>) => void;
  onStyleChange: (patch: WidgetStyle) => void;
}

export default function EditorDetails({ draft, onChange, onStyleChange }: EditorDetailsProps) {
  const showCheckoutLabel = draft.ruleType !== 'CART_UPSELL';
  const showPlacement = draft.ruleType !== 'CART_UPSELL';
  const showVolumeTargeting = draft.ruleType === 'VOLUME_DISCOUNT';
  const showBundlePlacement = draft.ruleType === 'FIXED_BUNDLE' || draft.ruleType === 'MIX_AND_MATCH';

  return (
    <div className="section-card">
      <h3>Offer details</h3>
      <div className="grid-2">
        {showCheckoutLabel && (
          <div className="field">
            <label htmlFor="checkout-label">Checkout promo label</label>
            <input
              id="checkout-label"
              value={draft.widgetStyle.checkoutLabel ?? ''}
              onChange={(e) =>
                onStyleChange({ checkoutLabel: e.target.value, promoLabel: e.target.value })
              }
            />
          </div>
        )}
        {draft.ruleType === 'CART_UPSELL' && (
          <div className="field">
            <label htmlFor="block-title">Widget heading</label>
            <input
              id="block-title"
              value={draft.widgetStyle.blockTitle ?? ''}
              onChange={(e) => onStyleChange({ blockTitle: e.target.value })}
            />
          </div>
        )}
      </div>

      {showPlacement && (
        <>
          {showBundlePlacement && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>
                <input
                  type="checkbox"
                  checked={draft.applyToAllProducts}
                  onChange={(e) => onChange({ applyToAllProducts: e.target.checked })}
                  style={{ marginRight: 8 }}
                />
                Display on all product pages
              </label>
            </div>
          )}

          {showVolumeTargeting && (
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="volume-scope">What does this discount apply to?</label>
              <select
                id="volume-scope"
                value={draft.applyToAllProducts ? 'ALL' : 'ONE'}
                onChange={(e) => onChange({ applyToAllProducts: e.target.value === 'ALL' })}
              >
                <option value="ALL">All product pages</option>
                <option value="ONE">Selected products only</option>
              </select>
            </div>
          )}

          {!draft.applyToAllProducts && showBundlePlacement && (
            <div style={{ marginTop: 12 }}>
              <ProductSearchBar
                label="Primary target product"
                selectedIds={draft.targetProductId ? [draft.targetProductId] : []}
                maxItems={1}
                onChange={(ids) =>
                  onChange({
                    targetProductId: ids[0],
                    primaryProductId: ids[0],
                  })
                }
              />
            </div>
          )}

          {showVolumeTargeting && !draft.applyToAllProducts && (
            <div style={{ marginTop: 12 }}>
              <ProductSearchBar
                label="Selected products (max 25)"
                selectedIds={draft.items.components.map((c) => c.productId)}
                maxItems={25}
                onChange={(ids) =>
                  onChange({
                    items: {
                      components: ids.map((id, index) => ({
                        productId: id,
                        isPrimary: index === 0,
                        minQuantity: 1,
                      })),
                    },
                  })
                }
              />
            </div>
          )}

          {showVolumeTargeting && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>
                <input
                  type="checkbox"
                  checked={draft.allowVariantChoice}
                  onChange={(e) => onChange({ allowVariantChoice: e.target.checked })}
                  style={{ marginRight: 8 }}
                />
                Let customers choose different variation for each item
              </label>
            </div>
          )}

          {showVolumeTargeting && (
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="layout">Layout</label>
              <select
                id="layout"
                value={draft.layout ?? 'VERTICAL'}
                onChange={(e) =>
                  onChange({ layout: e.target.value as 'VERTICAL' | 'HORIZONTAL' })
                }
              >
                <option value="VERTICAL">Vertical</option>
                <option value="HORIZONTAL">Horizontal</option>
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}
