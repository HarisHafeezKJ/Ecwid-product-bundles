import type { RuleType } from '@pb/shared';
import { RULE_TYPE_DESCRIPTIONS, RULE_TYPE_LABELS } from '@pb/shared';

const OFFER_TYPES: RuleType[] = [
  'VOLUME_DISCOUNT',
  'FIXED_BUNDLE',
  'MIX_AND_MATCH',
  'CART_UPSELL',
];

interface CreateOfferModalProps {
  onClose: () => void;
  onSelect: (type: RuleType) => void;
}

export default function CreateOfferModal({ onClose, onSelect }: CreateOfferModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Create New Offer</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p style={{ marginTop: 0, color: 'var(--pb-text-muted)' }}>
            Choose the type of offer you want to create.
          </p>
          <div className="grid-2">
            {OFFER_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className="section-card"
                style={{ textAlign: 'left', cursor: 'pointer' }}
                onClick={() => onSelect(type)}
              >
                <strong>{RULE_TYPE_LABELS[type]}</strong>
                <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: 'var(--pb-text-muted)' }}>
                  {RULE_TYPE_DESCRIPTIONS[type]}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
