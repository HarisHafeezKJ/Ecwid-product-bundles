import type { DiscountType } from '@pb/shared';
import { DISCOUNT_TYPE_LABELS } from '@pb/shared';
import type { OfferDraft } from './editor-draft';

const DISCOUNT_TYPES: DiscountType[] = ['NONE', 'PERCENTAGE', 'FIXED_AMOUNT', 'SET_PRICE'];

interface EditorDiscountProps {
  draft: OfferDraft;
  onChange: (patch: Partial<OfferDraft>) => void;
}

export default function EditorDiscount({ draft, onChange }: EditorDiscountProps) {
  return (
    <div className="section-card">
      <h3>Bundle discount</h3>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="discount-type">Discount format</label>
          <select
            id="discount-type"
            value={draft.discountType}
            onChange={(e) => onChange({ discountType: e.target.value as DiscountType })}
          >
            {DISCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {DISCOUNT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        {draft.discountType !== 'NONE' && (
          <div className="field">
            <label htmlFor="discount-value">Discount amount</label>
            <input
              id="discount-value"
              type="number"
              min={0}
              max={draft.discountType === 'PERCENTAGE' ? 100 : 1_000_000}
              value={draft.discountValue}
              onChange={(e) => onChange({ discountValue: Number(e.target.value) })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
