import { useEffect, useMemo, useState } from 'react';
import type { OfferDraft } from '../components/editor/editor-draft';

function draftStorageKey(draft: OfferDraft): string {
  return `pb_draft_${draft.id ?? `new_${draft.ruleType}`}`;
}

export function useDraftAutosave(draft: OfferDraft, baselineJson: string) {
  const storageKey = useMemo(() => draftStorageKey(draft), [draft.id, draft.ruleType]);
  const [restoreOffer, setRestoreOffer] = useState<OfferDraft | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as OfferDraft;
      if (JSON.stringify(parsed) !== baselineJson) {
        setRestoreOffer(parsed);
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only check on mount / key change
  }, [storageKey]);

  useEffect(() => {
    const current = JSON.stringify(draft);
    if (current === baselineJson) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, current);
  }, [draft, baselineJson, storageKey]);

  const dismissRestore = () => {
    localStorage.removeItem(storageKey);
    setRestoreOffer(null);
  };

  const clearAutosave = () => {
    localStorage.removeItem(storageKey);
    setRestoreOffer(null);
  };

  return { restoreOffer, dismissRestore, clearAutosave };
}
