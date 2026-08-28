import type { OfferDraft } from './editor-draft';
import type { WidgetStyle } from '@pb/shared';

const VOLUME_COPY_FIELDS: { key: keyof WidgetStyle; label: string }[] = [
  { key: 'blockTitle', label: 'Block title' },
  { key: 'addToCartText', label: 'Add to cart button' },
  { key: 'summaryBuy', label: 'Summary buy text' },
  { key: 'summarySave', label: 'Summary save text' },
  { key: 'standardPriceText', label: 'Standard price text' },
];

const BUNDLE_COPY_FIELDS: { key: keyof WidgetStyle; label: string }[] = [
  { key: 'blockTitle', label: 'Block title' },
  { key: 'addToCartText', label: 'Add to cart text' },
  { key: 'buyAllAtText', label: 'Buy all at text' },
  { key: 'buyAllTagText', label: 'Buy all tag text' },
];

interface EditorCopyProps {
  draft: OfferDraft;
  onStyleChange: (patch: WidgetStyle) => void;
}

export default function EditorCopy({ draft, onStyleChange }: EditorCopyProps) {
  const fields =
    draft.ruleType === 'VOLUME_DISCOUNT' ? VOLUME_COPY_FIELDS : BUNDLE_COPY_FIELDS;

  return (
    <div className="section-card">
      <h3>Block customization</h3>
      <div className="grid-2">
        {fields.map((field) => (
          <div key={field.key} className="field">
            <label>{field.label}</label>
            <input
              value={String(draft.widgetStyle[field.key] ?? '')}
              onChange={(e) => onStyleChange({ [field.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
