import { ColorField, SizeField } from './style-fields';
import type { OfferDraft } from './editor-draft';
import type { WidgetStyle } from '@pb/shared';

interface EditorUpsellStyleProps {
  draft: OfferDraft;
  onStyleChange: (patch: WidgetStyle) => void;
}

export default function EditorUpsellStyle({ draft, onStyleChange }: EditorUpsellStyleProps) {
  const style = draft.widgetStyle;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="section-card">
        <h3>Block title</h3>
        <div className="grid-2">
          <ColorField label="Color" value={style.blockTitleColor} onChange={(v) => onStyleChange({ blockTitleColor: v })} />
          <SizeField label="Size" value={style.blockTitleSize} onChange={(v) => onStyleChange({ blockTitleSize: v })} />
        </div>
      </div>

      <div className="section-card">
        <h3>Product card</h3>
        <div className="grid-2">
          <ColorField label="Background" value={style.offerCardBg} onChange={(v) => onStyleChange({ offerCardBg: v })} />
          <ColorField label="Selected background" value={style.offerCardSelectedBg} onChange={(v) => onStyleChange({ offerCardSelectedBg: v })} />
          <ColorField label="Title color" value={style.productTitleColor} onChange={(v) => onStyleChange({ productTitleColor: v })} />
          <ColorField label="Price color" value={style.productPriceColor} onChange={(v) => onStyleChange({ productPriceColor: v })} />
        </div>
      </div>

      <div className="section-card">
        <h3>Buttons</h3>
        <div className="grid-2">
          <ColorField label="Add button background" value={style.ctaBg} onChange={(v) => onStyleChange({ ctaBg: v })} />
          <ColorField label="Add button text" value={style.ctaColor} onChange={(v) => onStyleChange({ ctaColor: v })} />
          <ColorField label="Selected tag color" value={style.buyAllTagColor} onChange={(v) => onStyleChange({ buyAllTagColor: v })} />
          <SizeField label="Button size" value={style.ctaSize} onChange={(v) => onStyleChange({ ctaSize: v })} />
        </div>
      </div>
    </div>
  );
}
