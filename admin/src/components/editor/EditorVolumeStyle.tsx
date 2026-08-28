import type { ReactNode } from 'react';
import { ColorField, SizeField } from './style-fields';
import type { OfferDraft } from './editor-draft';
import type { WidgetStyle } from '@pb/shared';

const VOLUME_PRESETS = [
  {
    id: 'clean-minimal',
    name: 'Clean Minimal',
    style: {
      offerCardBg: '#ffffff',
      offerCardBorder: '#e5e7eb',
      offerCardSelectedBg: '#f9fafb',
      offerCardSelectedBorder: '#111827',
      ctaBg: '#111827',
      ctaColor: '#ffffff',
    },
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    style: {
      offerCardBg: '#f0f9ff',
      offerCardBorder: '#bae6fd',
      offerCardSelectedBg: '#e0f2fe',
      offerCardSelectedBorder: '#0284c7',
      ctaBg: '#0284c7',
      ctaColor: '#ffffff',
      offerTitleColor: '#0c4a6e',
    },
  },
  {
    id: 'sunset-gold',
    name: 'Sunset Gold',
    style: {
      offerCardBg: '#fffbeb',
      offerCardBorder: '#fde68a',
      offerCardSelectedBg: '#fef3c7',
      offerCardSelectedBorder: '#d97706',
      ctaBg: '#d97706',
      ctaColor: '#ffffff',
      offerTitleColor: '#92400e',
    },
  },
  {
    id: 'modern-dark',
    name: 'Modern Dark',
    style: {
      offerCardBg: '#1f2937',
      offerCardBorder: '#374151',
      offerCardSelectedBg: '#111827',
      offerCardSelectedBorder: '#22c55e',
      offerTitleColor: '#f9fafb',
      offerSubtitleColor: '#9ca3af',
      priceColor: '#f9fafb',
      ctaBg: '#22c55e',
      ctaColor: '#111827',
      blockTitleColor: '#f9fafb',
    },
  },
] as const;

function StyleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="section-card">
      <h3>{title}</h3>
      <div className="grid-2">{children}</div>
    </div>
  );
}

interface EditorVolumeStyleProps {
  draft: OfferDraft;
  onStyleChange: (patch: WidgetStyle) => void;
  onChange: (patch: Partial<OfferDraft>) => void;
}

export default function EditorVolumeStyle({
  draft,
  onStyleChange,
  onChange,
}: EditorVolumeStyleProps) {
  const style = draft.widgetStyle;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="section-card">
        <h3>Quick theme presets</h3>
        <div className="grid-2">
          {VOLUME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="btn btn-secondary"
              onClick={() => onStyleChange(preset.style)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <StyleSection title="Block title">
        <ColorField label="Color" value={style.blockTitleColor} onChange={(v) => onStyleChange({ blockTitleColor: v })} />
        <SizeField label="Size" value={style.blockTitleSize} onChange={(v) => onStyleChange({ blockTitleSize: v })} />
      </StyleSection>

      <StyleSection title="Offer card">
        <ColorField label="Background" value={style.offerCardBg} onChange={(v) => onStyleChange({ offerCardBg: v })} />
        <ColorField label="Border" value={style.offerCardBorder} onChange={(v) => onStyleChange({ offerCardBorder: v })} />
        <ColorField label="Selected background" value={style.offerCardSelectedBg} onChange={(v) => onStyleChange({ offerCardSelectedBg: v })} />
        <ColorField label="Selected border" value={style.offerCardSelectedBorder} onChange={(v) => onStyleChange({ offerCardSelectedBorder: v })} />
      </StyleSection>

      <StyleSection title="Offer title & price">
        <ColorField label="Title color" value={style.offerTitleColor} onChange={(v) => onStyleChange({ offerTitleColor: v })} />
        <SizeField label="Title size" value={style.offerTitleSize} onChange={(v) => onStyleChange({ offerTitleSize: v })} />
        <ColorField label="Subtitle color" value={style.offerSubtitleColor} onChange={(v) => onStyleChange({ offerSubtitleColor: v })} />
        <ColorField label="Price color" value={style.priceColor} onChange={(v) => onStyleChange({ priceColor: v })} />
      </StyleSection>

      <StyleSection title="Add to cart button">
        <ColorField label="Background" value={style.ctaBg} onChange={(v) => onStyleChange({ ctaBg: v })} />
        <ColorField label="Text" value={style.ctaColor} onChange={(v) => onStyleChange({ ctaColor: v })} />
        <SizeField label="Font size" value={style.ctaSize} onChange={(v) => onStyleChange({ ctaSize: v })} />
      </StyleSection>

      <div className="section-card">
        <h3>Layout</h3>
        <select
          value={draft.layout ?? 'VERTICAL'}
          onChange={(e) => onChange({ layout: e.target.value as 'VERTICAL' | 'HORIZONTAL' })}
        >
          <option value="VERTICAL">Vertical</option>
          <option value="HORIZONTAL">Horizontal</option>
        </select>
      </div>
    </div>
  );
}
