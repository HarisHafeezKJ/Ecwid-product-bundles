import { decodeEcwidNestedJson, unwrapStorageDoc, wrapStorageDoc } from '@pb/shared';
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

function extractStorageValue(data: unknown, key: string): unknown {
  if (Array.isArray(data)) {
    const row =
      data.find(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          (entry as { key?: string }).key === key,
      ) ?? data[0];
    if (row && typeof row === 'object' && 'value' in row) {
      return (row as { value: unknown }).value;
    }
    return undefined;
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if ('value' in obj) return obj.value;
    return data;
  }

  return undefined;
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

  const data = (await res.json()) as unknown;
  const raw = extractStorageValue(data, key);
  return unwrapStorageDoc<T>(raw);
}

/** Write a private storage key (PUT replaces value). */
export async function writeStorageJson(
  tokens: EcwidStoreTokens,
  key: string,
  value: unknown,
): Promise<void> {
  const payload = wrapStorageDoc(value);
  const res = await storageRequest(tokens, key, {
    method: 'PUT',
    body: JSON.stringify({ value: JSON.stringify(payload) }),
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

/** @deprecated Import from `@pb/shared` — kept for transitional server imports. */
export { decodeEcwidNestedJson };
