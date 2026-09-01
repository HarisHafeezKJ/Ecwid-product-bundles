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

/** Decode Ecwid storage payloads (string JSON, nested strings, or { value } envelopes). */
function decodeStorageJson<T>(raw: unknown): T | null {
  if (raw == null) return null;

  let current: unknown = raw;
  for (let depth = 0; depth < 4; depth++) {
    if (typeof current === 'string') {
      const trimmed = current.trim();
      if (!trimmed) return null;
      try {
        current = JSON.parse(trimmed);
        continue;
      } catch {
        return null;
      }
    }

    if (current && typeof current === 'object' && !Array.isArray(current)) {
      const envelope = current as Record<string, unknown>;
      if (envelope.value != null) {
        const keys = Object.keys(envelope);
        const isApiEnvelope =
          keys.length === 1 ||
          (keys.length === 2 && keys.includes('key') && keys.includes('value'));
        if (isApiEnvelope) {
          current = envelope.value;
          continue;
        }
      }
    }

    break;
  }

  if (current && typeof current === 'object') return current as T;
  return null;
}

function extractStorageValue(
  data: unknown,
  key: string,
): unknown {
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
  return decodeStorageJson<T>(raw);
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
