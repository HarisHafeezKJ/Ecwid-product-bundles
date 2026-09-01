import { useCallback, useEffect, useState } from 'react';
import type { RuleType } from '@pb/shared';
import { checkDashboardSession, consumeServerAuthError } from './api/session';
import DashboardHome from './pages/DashboardHome';
import OfferEditor from './pages/OfferEditor';
import { blankDraft } from './components/editor/editor-draft';
import type { OfferDraft } from './components/editor/editor-draft';

type View =
  | { name: 'home' }
  | { name: 'editor'; mode: 'create' | 'edit'; draft: OfferDraft };

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ name: 'home' });
  const [listEpoch, setListEpoch] = useState(0);

  useEffect(() => {
    void checkDashboardSession().then((authenticated) => {
      if (!authenticated) {
        const serverError = consumeServerAuthError();
        if (serverError || window.self !== window.top) {
          setAuthError(
            serverError ??
              'Unable to authenticate inside Ecwid. Check that ECWID_CLIENT_SECRET matches your Ecwid app.',
          );
          setAuthReady(true);
          return;
        }
        window.location.href = '/api/auth/install';
        return;
      }
      setAuthReady(true);
    });
  }, []);

  const openCreate = useCallback((ruleType: RuleType) => {
    setView({ name: 'editor', mode: 'create', draft: blankDraft(ruleType) });
  }, []);

  const openEdit = useCallback((draft: OfferDraft) => {
    setView({ name: 'editor', mode: 'edit', draft });
  }, []);

  const closeEditor = useCallback((saved: boolean) => {
    setView({ name: 'home' });
    if (saved) setListEpoch((n) => n + 1);
  }, []);

  if (!authReady) {
    return (
      <div className="app-shell">
        <main className="app-main">Loading…</main>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <p>{authError}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Product Bundles &amp; Upsells</h1>
        {view.name === 'editor' && (
          <button type="button" className="btn btn-ghost" onClick={() => closeEditor(false)}>
            ← Back to offers
          </button>
        )}
      </header>
      <main className="app-main">
        <div style={{ display: view.name === 'home' ? 'block' : 'none' }}>
          <DashboardHome
            listEpoch={listEpoch}
            onCreate={openCreate}
            onEdit={openEdit}
          />
        </div>
        {view.name === 'editor' && (
          <OfferEditor
            key={`${view.mode}-${view.draft.id ?? view.draft.ruleType}`}
            mode={view.mode}
            initialDraft={view.draft}
            onClose={closeEditor}
          />
        )}
      </main>
    </div>
  );
}

export default App;
