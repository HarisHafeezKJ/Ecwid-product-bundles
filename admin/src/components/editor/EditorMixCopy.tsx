import type { OfferDraft } from './editor-draft';
import type { WidgetStyle } from '@pb/shared';

const MIX_COPY_FIELDS: { key: keyof WidgetStyle; label: string; group: 'left' | 'right' }[] = [
  { key: 'blockTitle', label: 'Block title', group: 'left' },
  { key: 'addToCartText', label: 'Add to cart button', group: 'left' },
  { key: 'addingToCartText', label: 'Adding to cart text', group: 'left' },
  { key: 'qtyPromptText', label: 'Quantity prompt (use {{COUNT}})', group: 'left' },
  { key: 'summaryTitle', label: 'Summary title', group: 'left' },
  { key: 'summarySubtitle', label: 'Summary subtitle', group: 'left' },
  { key: 'checkoutLabel', label: 'Checkout promo label', group: 'right' },
  { key: 'outOfStockText', label: 'Out of stock text', group: 'right' },
  { key: 'unavailableOptionText', label: 'Unavailable text', group: 'right' },
  { key: 'variantLabel', label: 'Variant label', group: 'right' },
];

interface EditorMixCopyProps {
  draft: OfferDraft;
  onStyleChange: (patch: WidgetStyle) => void;
}

export default function EditorMixCopy({ draft, onStyleChange }: EditorMixCopyProps) {
  const left = MIX_COPY_FIELDS.filter((f) => f.group === 'left');
  const right = MIX_COPY_FIELDS.filter((f) => f.group === 'right');

  return (
    <div className="section-card">
      <h3>Mix &amp; Match copy</h3>
      <div className="grid-2">
        <div>
          {left.map((field) => (
            <div key={field.key} className="field" style={{ marginBottom: 12 }}>
              <label>{field.label}</label>
              <input
                value={String(draft.widgetStyle[field.key] ?? '')}
                onChange={(e) => onStyleChange({ [field.key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div>
          {right.map((field) => (
            <div key={field.key} className="field" style={{ marginBottom: 12 }}>
              <label>{field.label}</label>
              <input
                value={String(draft.widgetStyle[field.key] ?? '')}
                onChange={(e) => onStyleChange({ [field.key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
