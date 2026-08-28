import type { OfferDraft } from './editor-draft';
import EditorBundleStyle from './EditorBundleStyle';
import EditorMixMatchStyle from './EditorMixMatchStyle';
import EditorUpsellStyle from './EditorUpsellStyle';
import EditorVolumeStyle from './EditorVolumeStyle';
import type { WidgetStyle } from '@pb/shared';

interface EditorStyleProps {
  draft: OfferDraft;
  onStyleChange: (patch: WidgetStyle) => void;
  onChange: (patch: Partial<OfferDraft>) => void;
}

export default function EditorStyle({ draft, onStyleChange, onChange }: EditorStyleProps) {
  switch (draft.ruleType) {
    case 'VOLUME_DISCOUNT':
      return <EditorVolumeStyle draft={draft} onStyleChange={onStyleChange} onChange={onChange} />;
    case 'FIXED_BUNDLE':
      return <EditorBundleStyle draft={draft} onStyleChange={onStyleChange} />;
    case 'MIX_AND_MATCH':
      return <EditorMixMatchStyle draft={draft} onStyleChange={onStyleChange} />;
    case 'CART_UPSELL':
      return <EditorUpsellStyle draft={draft} onStyleChange={onStyleChange} />;
    default:
      return null;
  }
}
