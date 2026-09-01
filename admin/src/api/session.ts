const SESSION_STORAGE_KEY = 'pb_session_bootstrap';
const ECWID_SDK_URL = 'https://djqizrxa6f10j.cloudfront.net/ecwid-sdk/js/1.3.0/ecwid-app.js';

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

export function dashboardAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const bootstrap = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (bootstrap) headers.Authorization = `Bearer ${bootstrap}`;
  return headers;
}

function loadEcwidSdk(): Promise<void> {
  const w = window as Window & EcwidAppGlobal;
  if (w.EcwidApp) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ECWID_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Ecwid SDK'));
    document.head.appendChild(script);
  });
}

async function initEcwidNativeShell(clientId: string): Promise<void> {
  if (window.self === window.top) return;
  await loadEcwidSdk();
  const w = window as Window & EcwidAppGlobal;
  w.EcwidApp?.init({
    app_id: clientId,
    autoloadedflag: true,
    autoheight: true,
  });
}

export async function checkDashboardSession(): Promise<boolean> {
  captureSessionBootstrapFromUrl();

  const res = await fetch('/api/auth/session', {
    credentials: 'include',
    headers: dashboardAuthHeaders(),
  });
  const data = (await res.json()) as { authenticated?: boolean; clientId?: string };
  if (data.authenticated && data.clientId) {
    await initEcwidNativeShell(data.clientId);
  }
  return Boolean(data.authenticated);
}
