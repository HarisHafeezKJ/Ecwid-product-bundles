import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { BundleRule, RuleType } from '@pb/shared';
import { isRuleType } from '@pb/shared';
import * as api from './api/client';
import { checkDashboardSession, consumeServerAuthError } from './api/session';
import DashboardHome from './pages/DashboardHome';
import OfferEditor from './pages/OfferEditor';
import { blankDraft, draftFromRule } from './components/editor/editor-draft';
import type { OfferDraft } from './components/editor/editor-draft';
import { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    void checkDashboardSession()
      .then((authenticated) => {
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
      })
      .catch((err) => {
        setAuthError(
          err instanceof Error ? err.message : 'Could not reach the server. Try again.',
        );
        setAuthReady(true);
      });
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
      <Outlet />
    </div>
  );
}

function EditorShell({
  onBack,
  children,
}: {
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <header className="app-header">
        <h1>Product Bundles &amp; Upsells</h1>
        {onBack && (
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            ← Back to offers
          </button>
        )}
      </header>
      <main className="app-main">{children}</main>
    </>
  );
}

export function DashboardRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [listEpoch, setListEpoch] = useState(0);
  const [savedRuleHint, setSavedRuleHint] = useState<BundleRule | null>(null);

  useEffect(() => {
    const state = location.state as { refreshList?: boolean; savedRule?: BundleRule | null } | null;
    if (!state?.refreshList) return;

    // The saved-rule path already refreshes as part of its optimistic update, so bumping
    // the epoch as well would fire a second list fetch for the same save.
    if (state.savedRule) setSavedRuleHint(state.savedRule);
    else setListEpoch((value) => value + 1);

    navigate('.', { replace: true, state: null });
  }, [location.state, navigate]);

  const openCreate = useCallback(
    (ruleType: RuleType) => {
      navigate(`/offers/new/${ruleType}`);
    },
    [navigate],
  );

  const openEdit = useCallback(
    (draft: OfferDraft) => {
      if (draft.id) navigate(`/offers/${draft.id}/edit`);
    },
    [navigate],
  );

  return (
    <>
      <header className="app-header">
        <h1>Product Bundles &amp; Upsells</h1>
      </header>
      <main className="app-main">
        <DashboardHome
          listEpoch={listEpoch}
          savedRuleHint={savedRuleHint}
          onClearSavedRuleHint={() => setSavedRuleHint(null)}
          onCreate={openCreate}
          onEdit={openEdit}
        />
      </main>
    </>
  );
}

function useCloseHandlers(setDirty: (dirty: boolean) => void) {
  const navigate = useNavigate();

  const handleClose = useCallback(
    (saved: boolean, rule?: BundleRule) => {
      setDirty(false);
      navigate('/', {
        replace: true,
        state: saved ? { refreshList: true, savedRule: rule ?? null } : undefined,
      });
    },
    [navigate, setDirty],
  );

  // replace, not push — otherwise browser back from the dashboard reopens the editor.
  const handleBack = useCallback(() => navigate('/', { replace: true }), [navigate]);

  return { handleClose, handleBack };
}

export function CreateOfferRoute() {
  const { ruleType } = useParams();
  const [editorDirty, setEditorDirty] = useState(false);
  const { handleClose, handleBack } = useCloseHandlers(setEditorDirty);
  useUnsavedChangesGuard(editorDirty);

  if (!ruleType || !isRuleType(ruleType)) {
    return <Navigate to="/" replace />;
  }

  return (
    <EditorShell onBack={handleBack}>
      <OfferEditor
        key={`create-${ruleType}`}
        initialDraft={blankDraft(ruleType)}
        onClose={handleClose}
        onDirtyChange={setEditorDirty}
      />
    </EditorShell>
  );
}

type EditLoadState =
  | { status: 'loading' }
  | { status: 'ready'; rule: BundleRule }
  | { status: 'missing' }
  | { status: 'error'; message: string };

export function EditOfferRoute() {
  const { id } = useParams();
  const [editorDirty, setEditorDirty] = useState(false);
  const [load, setLoad] = useState<EditLoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const { handleClose, handleBack } = useCloseHandlers(setEditorDirty);
  useUnsavedChangesGuard(editorDirty);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoad({ status: 'loading' });

    void api
      .getRule(id)
      .then((rule) => {
        if (cancelled) return;
        setLoad(rule ? { status: 'ready', rule } : { status: 'missing' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Only a genuine 404 means the offer is gone; a network or server failure is
        // transient and must not silently bounce the user back to the dashboard.
        if (err instanceof api.ApiError && err.status === 404) {
          setLoad({ status: 'missing' });
          return;
        }
        setLoad({
          status: 'error',
          message: err instanceof Error ? err.message : 'Could not load this offer.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (!id || load.status === 'missing') return <Navigate to="/" replace />;

  if (load.status === 'loading') {
    return (
      <EditorShell onBack={handleBack}>
        <div className="empty-state">Loading offer…</div>
      </EditorShell>
    );
  }

  if (load.status === 'error') {
    return (
      <EditorShell onBack={handleBack}>
        <div className="error-banner">
          <p>{load.message}</p>
          <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      </EditorShell>
    );
  }

  return (
    <EditorShell onBack={handleBack}>
      <OfferEditor
        key={id}
        initialDraft={draftFromRule(load.rule)}
        onClose={handleClose}
        onDirtyChange={setEditorDirty}
      />
    </EditorShell>
  );
}
