import type { OfferDraft } from './editor-draft';
import VolumeTiersEditor from './VolumeTiersEditor';

interface EditorMixMatchRulesProps {
  draft: OfferDraft;
  onChange: (patch: Partial<OfferDraft>) => void;
}

export default function EditorMixMatchRules({ draft, onChange }: EditorMixMatchRulesProps) {
  return (
    <VolumeTiersEditor
      draft={draft}
      onChange={onChange}
      exactQty={false}
      title="Mix & Match tiers"
      qtyLabel="Minimum items required"
    />
  );
}
