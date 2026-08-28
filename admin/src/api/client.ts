import type { AppSettings, BundleRule, CatalogProduct, RuleStatus } from '@pb/shared';
import { dashboardAuthHeaders } from './session';

function requestHeaders(): Record<string, string> {
  return dashboardAuthHeaders();
}

async function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    window.location.href = '/api/auth/install';
    throw new Error('Redirecting to sign in…');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body === 'object' && body && 'error' in body
        ? String((body as { error: string }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function apiUrl(path: string, query?: Record<string, string | undefined>): string {
  const url = new URL(`/api/dashboard${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export async function listRules(): Promise<BundleRule[]> {
  const res = await fetch(apiUrl('/rules'), { credentials: 'include', headers: requestHeaders() });
  const data = await parseJson<{ rules: BundleRule[] }>(res);
  return data.rules ?? [];
}

export async function getRule(id: string): Promise<BundleRule> {
  const res = await fetch(apiUrl(`/rules/${id}`), { credentials: 'include', headers: requestHeaders() });
  const data = await parseJson<{ rule: BundleRule }>(res);
  return data.rule;
}

export async function saveRule(input: Record<string, unknown>): Promise<BundleRule> {
  const res = await fetch(apiUrl('/rules'), {
    method: 'POST',
    credentials: 'include',
    headers: requestHeaders(),
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ rule: BundleRule }>(res);
  return data.rule;
}

export async function deleteRule(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/rules/${id}`), {
    method: 'DELETE',
    credentials: 'include',
    headers: requestHeaders(),
  });
  await parseJson(res);
}

export async function setRuleStatus(id: string, status: RuleStatus): Promise<BundleRule> {
  const res = await fetch(apiUrl(`/rules/${id}/status`), {
    method: 'PATCH',
    credentials: 'include',
    headers: requestHeaders(),
    body: JSON.stringify({ status }),
  });
  const data = await parseJson<{ rule: BundleRule }>(res);
  return data.rule;
}

export async function loadSettings(): Promise<AppSettings> {
  const res = await fetch(apiUrl('/settings'), { credentials: 'include', headers: requestHeaders() });
  const data = await parseJson<{ settings: AppSettings }>(res);
  return data.settings;
}

export async function searchProducts(query: string, limit = 24): Promise<CatalogProduct[]> {
  const res = await fetch(apiUrl('/products', { search: query, limit: String(limit) }), {
    credentials: 'include',
    headers: requestHeaders(),
  });
  const data = await parseJson<{ products: CatalogProduct[] }>(res);
  return data.products ?? [];
}

export async function setCartScriptEnabled(enabled: boolean): Promise<void> {
  const res = await fetch(apiUrl('/settings/cart-upsell'), {
    method: 'PATCH',
    credentials: 'include',
    headers: requestHeaders(),
    body: JSON.stringify({ enabled }),
  });
  await parseJson(res);
}
