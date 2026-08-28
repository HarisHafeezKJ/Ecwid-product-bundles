import { getManifest } from '../config.js';
import type { EcwidStoreTokens } from '../ecwid.js';

const ECWID_API_BASE = 'https://app.ecwid.com/api/v3';

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function storageRequest(
  tokens: EcwidStoreTokens,
  key: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${ECWID_API_BASE}/${tokens.storeId}/storage/${encodeURIComponent(key)}`;
  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeader(tokens.accessToken),
      ...(init?.headers ?? {}),
    },
  });
}

/** Read a private storage key. Returns null when missing. */
export async function readStorageJson<T>(
  tokens: EcwidStoreTokens,
  key: string,
): Promise<T | null> {
  const res = await storageRequest(tokens, key, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ecwid storage GET ${key} failed: ${text || res.statusText}`);
  }

  const data = (await res.json()) as Array<{ key: string; value: string }> | { value?: string };
  let raw: string | undefined;

  if (Array.isArray(data)) {
    raw = data.find((row) => row.key === key)?.value ?? data[0]?.value;
  } else if (data && typeof data === 'object' && 'value' in data) {
    raw = data.value;
  }

  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write a private storage key (PUT replaces value). */
export async function writeStorageJson(
  tokens: EcwidStoreTokens,
  key: string,
  value: unknown,
): Promise<void> {
  const res = await storageRequest(tokens, key, {
    method: 'PUT',
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ecwid storage PUT ${key} failed: ${text || res.statusText}`);
  }
}

/** Update Ecwid public storage (storefront-readable via getAppPublicConfig). */
export async function writePublicConfig(
  tokens: EcwidStoreTokens,
  value: Record<string, unknown>,
): Promise<void> {
  const key = getManifest().storage.public;
  await writeStorageJson(tokens, key, value);
}

export async function readPublicConfig(
  tokens: EcwidStoreTokens,
): Promise<Record<string, unknown> | null> {
  const key = getManifest().storage.public;
  return readStorageJson<Record<string, unknown>>(tokens, key);
}

export function storageKeys() {
  return getManifest().storage;
}
