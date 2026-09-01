import { useCallback, useEffect, useRef, useState } from 'react';
import { validateRuleForm, type BundleRule } from '@pb/shared';
import * as api from '../api/client';
import EditorSetup from '../components/editor/EditorSetup';
import EditorStyle from '../components/editor/EditorStyle';
import PreviewFrame from '../components/editor/PreviewFrame';
import StorefrontPreview from '../components/editor/StorefrontPreview';
import { draftFromRule, draftToRuleInput } from '../components/editor/editor-draft';
import type { OfferDraft } from '../components/editor/editor-draft';

interface OfferEditorProps {
  /** Fully resolved by the route — the editor never fetches the rule itself. */
  initialDraft: OfferDraft;
  onClose: (saved: boolean, rule?: BundleRule) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function OfferEditor({ initialDraft, onClose, onDirtyChange }: OfferEditorProps) {
  const [draft, setDraft] = useState<OfferDraft>(initialDraft);
  const baselineRef = useRef(JSON.stringify(initialDraft));
  const [tab, setTab] = useState<'setup' | 'style'>('setup');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const patchDraft = useCallback((patch: Partial<OfferDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setValidationErrors([]);
    setSaveError(null);
  }, []);

  const patchStyle = useCallback((patch: OfferDraft['widgetStyle']) => {
    setDraft((prev) => ({ ...prev, widgetStyle: { ...prev.widgetStyle, ...patch } }));
    setValidationErrors([]);
    setSaveError(null);
  }, []);

  useEffect(() => {
    const dirty = JSON.stringify(draft) !== baselineRef.current;
    onDirtyChange?.(dirty);
  }, [draft, onDirtyChange]);

  const requestClose = useCallback(() => {
    if (JSON.stringify(draft) !== baselineRef.current) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    onClose(false);
  }, [draft, onClose]);

  const handleSave = async () => {
    const validation = validateRuleForm(draft);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setValidationErrors([]);
    try {
      const rule = await api.saveRule(draftToRuleInput(draft));
      baselineRef.current = JSON.stringify(draftFromRule(rule));
      setToast('Saved successfully.');
      setTimeout(() => onClose(true, rule), 600);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the rule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="offer-title">Offer name</label>
            <input
              id="offer-title"
              value={draft.title}
              onChange={(e) => patchDraft({ title: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              {draft.activateOnSave !== false ? 'Active' : 'Paused'}
            </span>
            <label className="toggle">
              <span className="sr-only">
                {draft.activateOnSave !== false ? 'Offer active' : 'Offer paused'}
              </span>
              <input
                type="checkbox"
                checked={draft.activateOnSave !== false}
                onChange={(e) =>
                  patchDraft({
                    activateOnSave: e.target.checked,
                    status: e.target.checked ? 'ACTIVE' : 'DISABLED',
                  })
                }
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={requestClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save Offer'}
            </button>
          </div>
        </div>
      </div>

      {saveError && <div className="error-banner" style={{ marginBottom: 16 }}>{saveError}</div>}
      {validationErrors.length > 0 && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          <strong>Fix the following before saving:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {validationErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="editor-layout">
        <div className="editor-panel">
          <div className="editor-tabs">
            <button
              type="button"
              className={tab === 'setup' ? 'active' : ''}
              onClick={() => setTab('setup')}
            >
              1. Setup &amp; Offer Rules
            </button>
            <button
              type="button"
              className={tab === 'style' ? 'active' : ''}
              onClick={() => setTab('style')}
            >
              2. Design &amp; Storefront Style
            </button>
          </div>

          {tab === 'setup' ? (
            <EditorSetup draft={draft} onChange={patchDraft} onStyleChange={patchStyle} />
          ) : (
            <EditorStyle draft={draft} onStyleChange={patchStyle} onChange={patchDraft} />
          )}
        </div>

        <PreviewFrame device={device} onDeviceChange={setDevice}>
          <StorefrontPreview draft={draft} />
        </PreviewFrame>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
