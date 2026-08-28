import type { TierDiscountType } from '@pb/shared';
import { defaultVolumeTiersForRuleType } from '@pb/shared';
import type { OfferDraft } from './editor-draft';

const TIER_DISCOUNT_TYPES: TierDiscountType[] = ['PERCENTAGE', 'FIXED_AMOUNT', 'SET_PRICE'];

interface VolumeTiersEditorProps {
  draft: OfferDraft;
  onChange: (patch: Partial<OfferDraft>) => void;
  exactQty?: boolean;
  title?: string;
  qtyLabel?: string;
}

export default function VolumeTiersEditor({
  draft,
  onChange,
  exactQty = true,
  title = 'Quantity tiers',
  qtyLabel = exactQty ? 'Exact quantity' : 'Minimum items required',
}: VolumeTiersEditorProps) {
  const tiers = draft.volumeTiers.tiers.length
    ? draft.volumeTiers.tiers
    : defaultVolumeTiersForRuleType(
        draft.ruleType === 'MIX_AND_MATCH' ? 'MIX_AND_MATCH' : 'VOLUME_DISCOUNT',
      );

  const updateTier = (index: number, patch: Partial<(typeof tiers)[0]>) => {
    const next = tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier));
    onChange({ volumeTiers: { tiers: next } });
  };

  const addTier = () => {
    if (tiers.length >= 5) return;
    const lastQty = tiers[tiers.length - 1]?.qty ?? 0;
    onChange({
      volumeTiers: {
        tiers: [
          ...tiers,
          {
            qty: lastQty + 1,
            discountType: 'PERCENTAGE',
            discountValue: 10,
            title: `#${tiers.length + 1} Deal Offer`,
          },
        ],
      },
    });
  };

  const removeTier = (index: number) => {
    if (tiers.length <= (exactQty ? 2 : 1)) return;
    onChange({ volumeTiers: { tiers: tiers.filter((_, i) => i !== index) } });
  };

  return (
    <div className="section-card">
      <h3>{title}</h3>
      {tiers.map((tier, index) => (
        <div key={index} className="grid-2" style={{ marginBottom: 12, alignItems: 'end' }}>
          <div className="field">
            <label>Tier title</label>
            <input
              value={tier.title ?? ''}
              onChange={(e) => updateTier(index, { title: e.target.value })}
            />
          </div>
          <div className="field">
            <label>{qtyLabel}</label>
            <input
              type="number"
              min={1}
              value={tier.qty}
              onChange={(e) => updateTier(index, { qty: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Discount type</label>
            <select
              value={tier.discountType}
              onChange={(e) =>
                updateTier(index, { discountType: e.target.value as TierDiscountType })
              }
            >
              {TIER_DISCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Discount value</label>
            <input
              type="number"
              min={0}
              value={tier.discountValue}
              onChange={(e) => updateTier(index, { discountValue: Number(e.target.value) })}
            />
          </div>
          {exactQty && (
            <>
              <div className="field">
                <label>Image URL</label>
                <input
                  value={tier.imageUrl ?? ''}
                  onChange={(e) => updateTier(index, { imageUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="field">
                <label>Image size ({tier.imageSize ?? 86}px)</label>
                <input
                  type="range"
                  min={24}
                  max={200}
                  value={tier.imageSize ?? 86}
                  onChange={(e) => updateTier(index, { imageSize: Number(e.target.value) })}
                />
              </div>
            </>
          )}
          <div>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={tiers.length <= (exactQty ? 2 : 1)}
              onClick={() => removeTier(index)}
            >
              Remove tier
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" disabled={tiers.length >= 5} onClick={addTier}>
        Add tier
      </button>
    </div>
  );
}
