const SESSION_STORAGE_KEY = 'pb_session_bootstrap';
const AUTH_ERROR_KEY = 'pb_auth_error';

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

export function consumeServerAuthError(): string | null {
  const message = sessionStorage.getItem(AUTH_ERROR_KEY);
  if (message) sessionStorage.removeItem(AUTH_ERROR_KEY);
  return message;
}

export function peekServerAuthError(): string | null {
  return sessionStorage.getItem(AUTH_ERROR_KEY);
}

export async function checkDashboardSession(): Promise<boolean> {
  captureSessionBootstrapFromUrl();
  if (peekServerAuthError()) {
    return false;
  }

  const res = await fetch('/api/auth/session', {
    credentials: 'include',
    headers: dashboardAuthHeaders(),
  });
  const data = (await res.json()) as { authenticated?: boolean };
  // #region agent log
  fetch('http://127.0.0.1:7627/ingest/17a22ea5-cb1e-474a-bba3-194752c05bb0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c36960'},body:JSON.stringify({sessionId:'c36960',location:'admin/src/api/session.ts:checkDashboardSession',message:'Session check result',data:{authenticated:Boolean(data.authenticated),hasBootstrap:Boolean(sessionStorage.getItem(SESSION_STORAGE_KEY)),hasEcwidApp:Boolean((window as Window & { EcwidApp?: unknown }).EcwidApp),inIframe:window.self!==window.top},timestamp:Date.now(),hypothesisId:'M',runId:'post-fix-3'})}).catch(()=>{});
  // #endregion
  return Boolean(data.authenticated);
}
