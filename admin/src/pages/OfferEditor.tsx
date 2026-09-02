import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { validateRuleForm, type BundleRule } from '@pb/shared';
import * as api from '../api/client';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import EditorSetup from '../components/editor/EditorSetup';
import EditorStyle from '../components/editor/EditorStyle';
import PreviewFrame from '../components/editor/PreviewFrame';
import StorefrontPreview from '../components/editor/StorefrontPreview';
import { draftFromRule, draftToRuleInput } from '../components/editor/editor-draft';
import type { OfferDraft } from '../components/editor/editor-draft';
import { useDraftAutosave } from '../hooks/useDraftAutosave';

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
  const [discardOpen, setDiscardOpen] = useState(false);

  const { restoreOffer, dismissRestore, clearAutosave } = useDraftAutosave(
    draft,
    baselineRef.current,
  );

  const dirty = JSON.stringify(draft) !== baselineRef.current;
  const liveValidation = useMemo(() => validateRuleForm(draft), [draft]);
  const setupHasErrors = dirty && !liveValidation.valid;

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
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const requestClose = useCallback(() => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose(false);
  }, [dirty, onClose]);

  const handleSave = async () => {
    const validation = validateRuleForm(draft);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      setTab('setup');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setValidationErrors([]);
    try {
      const rule = await api.saveRule(draftToRuleInput(draft));
      baselineRef.current = JSON.stringify(draftFromRule(rule));
      clearAutosave();
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
      {restoreOffer && (
        <div className="info-banner" style={{ marginBottom: 16 }}>
          <span>You have an unsaved draft for this offer.</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setDraft(restoreOffer);
                dismissRestore();
              }}
            >
              Restore draft
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={dismissRestore}>
              Dismiss
            </button>
          </div>
        </div>
      )}

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
      {setupHasErrors && validationErrors.length === 0 && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          <strong>Setup needs attention:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {liveValidation.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card editor-shell">
        <div className="editor-layout">
          <div className="editor-panel">
            <div className="editor-tabs">
            <button
              type="button"
              className={tab === 'setup' ? 'active' : ''}
              onClick={() => setTab('setup')}
            >
              1. Setup &amp; Offer Rules
              {setupHasErrors && (
                <span className="tab-error-badge" aria-label="Validation errors">
                  {liveValidation.errors.length}
                </span>
              )}
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
      </div>

      {discardOpen && (
        <ConfirmModal
          title="Discard changes"
          message="Discard unsaved changes?"
          confirmLabel="Discard"
          danger
          onCancel={() => setDiscardOpen(false)}
          onConfirm={() => {
            setDiscardOpen(false);
            clearAutosave();
            onClose(false);
          }}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
