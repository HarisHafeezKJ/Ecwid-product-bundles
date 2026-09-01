const SESSION_STORAGE_KEY = 'pb_session_bootstrap';

type EcwidAppGlobal = {
  EcwidApp?: {
    init: (options: { app_id: string; autoloadedflag: boolean; autoheight: boolean }) => void;
  };
};

/** Persist OAuth bootstrap token for Chrome iframe contexts that block third-party cookies. */
export function captureSessionBootstrapFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const bootstrap = params.get('bootstrap')?.trim();
  if (!bootstrap) return;
  sessionStorage.setItem(SESSION_STORAGE_KEY, bootstrap);
  params.delete('bootstrap');
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

/** Request Storage Access API when embedded in Ecwid admin (Chrome third-party cookie policy). */
export async function requestEmbeddedStorageAccess(): Promise<void> {
  if (window.self === window.top) return;
  const doc = document as Document & { requestStorageAccess?: () => Promise<void> };
  if (typeof doc.requestStorageAccess !== 'function') return;
  try {
    await doc.requestStorageAccess();
  } catch {
    // Fall back to Authorization header bootstrap token.
  }
}

export function dashboardAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const bootstrap = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (bootstrap) headers.Authorization = `Bearer ${bootstrap}`;
  return headers;
}

async function authenticateEcwidPayload(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const payload = params.get('payload')?.trim();
  if (!payload) return false;

  const res = await fetch('/api/auth/ecwid-payload', {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) return false;

  const data = (await res.json()) as { bootstrap?: string; clientId?: string };
  if (data.bootstrap) sessionStorage.setItem(SESSION_STORAGE_KEY, data.bootstrap);
  if (data.clientId) initEcwidNativeShell(data.clientId);

  params.delete('payload');
  const query = params.toString();
  window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  return true;
}

function initEcwidNativeShell(clientId: string): void {
  if (window.self === window.top) return;
  const w = window as Window & EcwidAppGlobal;
  if (!w.EcwidApp) return;
  w.EcwidApp.init({
    app_id: clientId,
    autoloadedflag: true,
    autoheight: true,
  });
}

export async function checkDashboardSession(): Promise<boolean> {
  captureSessionBootstrapFromUrl();
  await requestEmbeddedStorageAccess();
  await authenticateEcwidPayload();

  const res = await fetch('/api/auth/session', {
    credentials: 'include',
    headers: dashboardAuthHeaders(),
  });
  const data = (await res.json()) as { authenticated?: boolean; clientId?: string };
  if (data.authenticated && data.clientId) {
    initEcwidNativeShell(data.clientId);
  }
  return Boolean(data.authenticated);
}
