import type { OfferDraft } from './editor-draft';
import EditorBundleProducts from './EditorBundleProducts';
import EditorCopy from './EditorCopy';
import EditorDetails from './EditorDetails';
import EditorDiscount from './EditorDiscount';
import EditorMixCopy from './EditorMixCopy';
import EditorMixMatchPool from './EditorMixMatchPool';
import EditorMixMatchRules from './EditorMixMatchRules';
import EditorUpsellProducts from './EditorUpsellProducts';
import VolumeTiersEditor from './VolumeTiersEditor';
import type { WidgetStyle } from '@pb/shared';

interface EditorSetupProps {
  draft: OfferDraft;
  onChange: (patch: Partial<OfferDraft>) => void;
  onStyleChange: (patch: WidgetStyle) => void;
}

export default function EditorSetup({ draft, onChange, onStyleChange }: EditorSetupProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <EditorDetails draft={draft} onChange={onChange} onStyleChange={onStyleChange} />

      {draft.ruleType === 'FIXED_BUNDLE' && (
        <>
          <EditorBundleProducts draft={draft} onChange={onChange} />
          <EditorDiscount draft={draft} onChange={onChange} />
          <EditorCopy draft={draft} onStyleChange={onStyleChange} />
        </>
      )}

      {draft.ruleType === 'VOLUME_DISCOUNT' && (
        <>
          <VolumeTiersEditor draft={draft} onChange={onChange} exactQty />
          <EditorCopy draft={draft} onStyleChange={onStyleChange} />
        </>
      )}

      {draft.ruleType === 'MIX_AND_MATCH' && (
        <>
          <EditorMixMatchPool draft={draft} onChange={onChange} />
          <EditorMixMatchRules draft={draft} onChange={onChange} />
          <EditorMixCopy draft={draft} onStyleChange={onStyleChange} />
        </>
      )}

      {draft.ruleType === 'CART_UPSELL' && (
        <EditorUpsellProducts draft={draft} onChange={onChange} onStyleChange={onStyleChange} />
      )}
    </div>
  );
}
