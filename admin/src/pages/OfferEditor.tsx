import { useCallback, useEffect, useState } from 'react';
import { validateRuleForm } from '@pb/shared';
import * as api from '../api/client';
import EditorSetup from '../components/editor/EditorSetup';
import EditorStyle from '../components/editor/EditorStyle';
import PreviewFrame from '../components/editor/PreviewFrame';
import StorefrontPreview from '../components/editor/StorefrontPreview';
import { draftFromRule, draftToRuleInput } from '../components/editor/editor-draft';
import type { OfferDraft } from '../components/editor/editor-draft';

interface OfferEditorProps {
  mode: 'create' | 'edit';
  initialDraft: OfferDraft;
  onClose: (saved: boolean) => void;
}

export default function OfferEditor({ mode, initialDraft, onClose }: OfferEditorProps) {
  const [draft, setDraft] = useState<OfferDraft>(initialDraft);
  const [tab, setTab] = useState<'setup' | 'style'>('setup');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit' && !initialDraft.id);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const patchDraft = useCallback((patch: Partial<OfferDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchStyle = useCallback((patch: OfferDraft['widgetStyle']) => {
    setDraft((prev) => ({ ...prev, widgetStyle: { ...prev.widgetStyle, ...patch } }));
  }, []);

  useEffect(() => {
    if (mode === 'edit' && initialDraft.id) {
      void (async () => {
        setLoading(true);
        try {
          const rule = await api.getRule(initialDraft.id!);
          setDraft(draftFromRule(rule));
        } catch {
          setError('Could not load this offer. Cancel and try again.');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [mode, initialDraft.id]);

  const handleSave = async () => {
    const validation = validateRuleForm(draft);
    if (!validation.valid) {
      setError(validation.errors[0] ?? 'Fix validation errors.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.saveRule(draftToRuleInput(draft));
      setToast('Saved successfully.');
      setTimeout(() => onClose(true), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the rule.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="empty-state">Loading offer…</div>;
  }

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
            <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || Boolean(error?.includes('Could not load'))}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save Offer'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

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
