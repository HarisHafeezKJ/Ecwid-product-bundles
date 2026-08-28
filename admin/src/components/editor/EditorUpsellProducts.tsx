import { useEffect, useState } from 'react';
import * as api from '../../api/client';
import type { OfferDraft } from './editor-draft';
import ProductPoolGrid from './ProductPoolGrid';
import type { WidgetStyle } from '@pb/shared';

interface EditorUpsellProductsProps {
  draft: OfferDraft;
  onChange: (patch: Partial<OfferDraft>) => void;
  onStyleChange: (patch: WidgetStyle) => void;
}

export default function EditorUpsellProducts({
  draft,
  onChange,
  onStyleChange,
}: EditorUpsellProductsProps) {
  const [scriptEnabled, setScriptEnabled] = useState(false);
  const [scriptLoading, setScriptLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await api.loadSettings();
        setScriptEnabled(settings.cartUpsellEnabled ?? false);
      } finally {
        setScriptLoading(false);
      }
    })();
  }, []);

  const toggleScript = async () => {
    const next = !scriptEnabled;
    try {
      await api.setCartScriptEnabled(next);
      setScriptEnabled(next);
      alert(next ? 'Cart upsells enabled. Publish the site to apply.' : 'Cart upsell script disabled.');
    } catch {
      alert('Could not update the cart script.');
    }
  };

  return (
    <>
      <div className="section-card">
        <h3>Cart upsell script</h3>
        <p className="field-hint">
          Enable the embedded cart script so upsell offers appear on your cart page.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="toggle">
            <input
              type="checkbox"
              checked={scriptEnabled}
              disabled={scriptLoading}
              onChange={() => void toggleScript()}
            />
            <span className="toggle-slider" />
          </span>
          <span>{scriptEnabled ? 'Script enabled' : 'Script disabled'}</span>
        </label>
      </div>

      <div className="section-card">
        <h3>Trigger products</h3>
        <p className="field-hint">Show upsell when any of these products are in the cart.</p>
        <ProductPoolGrid
          selectedIds={draft.triggerProductIds}
          maxItems={50}
          minItems={1}
          onChange={(ids) => onChange({ triggerProductIds: ids })}
        />
      </div>

      <div className="section-card">
        <h3>Suggested upsell products</h3>
        <p className="field-hint">Products recommended when a trigger is in the cart.</p>
        <ProductPoolGrid
          selectedIds={draft.suggestedProductIds}
          maxItems={50}
          minItems={1}
          onChange={(ids) => onChange({ suggestedProductIds: ids })}
        />
      </div>

      <div className="section-card">
        <h3>Upsell copy</h3>
        <div className="grid-2">
          <div className="field">
            <label>Heading</label>
            <input
              value={draft.widgetStyle.blockTitle ?? ''}
              onChange={(e) => onStyleChange({ blockTitle: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Add button text</label>
            <input
              value={draft.widgetStyle.addToCartText ?? ''}
              onChange={(e) => onStyleChange({ addToCartText: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Selected button text</label>
            <input
              value={draft.widgetStyle.buyAllTagText ?? ''}
              onChange={(e) => onStyleChange({ buyAllTagText: e.target.value })}
            />
          </div>
        </div>
      </div>
    </>
  );
}
