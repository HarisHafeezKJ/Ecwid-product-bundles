import type { ProductDivider } from '@pb/shared';
import { ColorField, SizeField } from './style-fields';
import type { OfferDraft } from './editor-draft';
import type { WidgetStyle } from '@pb/shared';

const DIVIDERS: ProductDivider[] = ['LINE', 'PLUS', 'PLUS_LINE'];

interface EditorBundleStyleProps {
  draft: OfferDraft;
  onStyleChange: (patch: WidgetStyle) => void;
}

export default function EditorBundleStyle({ draft, onStyleChange }: EditorBundleStyleProps) {
  const style = draft.widgetStyle;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="section-card">
        <h3>Product dividers</h3>
        <select
          value={style.productDivider ?? style.dividerStyle ?? 'PLUS_LINE'}
          onChange={(e) =>
            onStyleChange({
              productDivider: e.target.value as ProductDivider,
              dividerStyle: e.target.value as ProductDivider,
            })
          }
        >
          {DIVIDERS.map((d) => (
            <option key={d} value={d}>
              {d.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="section-card">
        <h3>Block title</h3>
        <div className="grid-2">
          <ColorField label="Color" value={style.blockTitleColor} onChange={(v) => onStyleChange({ blockTitleColor: v })} />
          <SizeField label="Size" value={style.blockTitleSize} onChange={(v) => onStyleChange({ blockTitleSize: v })} />
        </div>
      </div>

      <div className="section-card">
        <h3>Product</h3>
        <div className="grid-2">
          <ColorField label="Title color" value={style.productTitleColor} onChange={(v) => onStyleChange({ productTitleColor: v })} />
          <SizeField label="Title size" value={style.productTitleSize} onChange={(v) => onStyleChange({ productTitleSize: v })} />
          <ColorField label="Qty color" value={style.productQtyColor} onChange={(v) => onStyleChange({ productQtyColor: v })} />
          <ColorField label="Price color" value={style.productPriceColor} onChange={(v) => onStyleChange({ productPriceColor: v })} />
        </div>
      </div>

      <div className="section-card">
        <h3>Buy all at &amp; CTA</h3>
        <div className="grid-2">
          <ColorField label="Buy all color" value={style.buyAllColor} onChange={(v) => onStyleChange({ buyAllColor: v })} />
          <ColorField label="Buy all price" value={style.buyAllPriceColor} onChange={(v) => onStyleChange({ buyAllPriceColor: v })} />
          <ColorField label="Tag color" value={style.buyAllTagColor} onChange={(v) => onStyleChange({ buyAllTagColor: v })} />
          <ColorField label="CTA background" value={style.ctaBg} onChange={(v) => onStyleChange({ ctaBg: v })} />
          <ColorField label="CTA text" value={style.ctaColor} onChange={(v) => onStyleChange({ ctaColor: v })} />
          <ColorField label="CTA success" value={style.ctaSuccessBg} onChange={(v) => onStyleChange({ ctaSuccessBg: v })} />
        </div>
      </div>
    </div>
  );
}
