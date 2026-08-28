import { ColorField, SizeField } from './style-fields';
import type { OfferDraft } from './editor-draft';
import type { WidgetStyle } from '@pb/shared';

interface EditorMixMatchStyleProps {
  draft: OfferDraft;
  onStyleChange: (patch: WidgetStyle) => void;
}

export default function EditorMixMatchStyle({ draft, onStyleChange }: EditorMixMatchStyleProps) {
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
          <ColorField label="Background" value={style.mixCardBg} onChange={(v) => onStyleChange({ mixCardBg: v })} />
          <ColorField label="Border" value={style.mixCardBorder} onChange={(v) => onStyleChange({ mixCardBorder: v })} />
          <ColorField label="Selected background" value={style.mixCardSelectedBg} onChange={(v) => onStyleChange({ mixCardSelectedBg: v })} />
          <ColorField label="Selected border" value={style.mixCardSelectedBorder} onChange={(v) => onStyleChange({ mixCardSelectedBorder: v })} />
          <ColorField label="Title color" value={style.productTitleColor} onChange={(v) => onStyleChange({ productTitleColor: v })} />
          <ColorField label="Price color" value={style.productPriceColor} onChange={(v) => onStyleChange({ productPriceColor: v })} />
        </div>
      </div>

      <div className="section-card">
        <h3>Summary &amp; CTA</h3>
        <div className="grid-2">
          <ColorField label="Summary background" value={style.mixSummaryBg} onChange={(v) => onStyleChange({ mixSummaryBg: v })} />
          <ColorField label="Summary border" value={style.mixSummaryBorder} onChange={(v) => onStyleChange({ mixSummaryBorder: v })} />
          <ColorField label="CTA background" value={style.ctaBg} onChange={(v) => onStyleChange({ ctaBg: v })} />
          <SizeField label="CTA size" value={style.ctaSize} onChange={(v) => onStyleChange({ ctaSize: v })} />
        </div>
      </div>
    </div>
  );
}
