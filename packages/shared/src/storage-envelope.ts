import { decodeEcwidNestedJson } from './ecwid-json.js';

export const STORAGE_ENVELOPE_VERSION = 2;

export interface StorageEnvelopeV2<T> {
  v: typeof STORAGE_ENVELOPE_VERSION;
  data: T;
}

export function isStorageEnvelopeV2<T>(raw: unknown): raw is StorageEnvelopeV2<T> {
  return (
    raw != null &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    (raw as StorageEnvelopeV2<T>).v === STORAGE_ENVELOPE_VERSION &&
    'data' in (raw as object)
  );
}

export function wrapStorageDoc<T>(data: T): StorageEnvelopeV2<T> {
  return { v: STORAGE_ENVELOPE_VERSION, data };
}

/** Unwrap a v2 storage envelope or return legacy bare payloads unchanged. */
export function unwrapStorageDoc<T>(raw: unknown): T | null {
  const decoded = decodeEcwidNestedJson(raw);
  if (decoded == null) return null;
  if (isStorageEnvelopeV2<T>(decoded)) return decoded.data;
  return decoded as T;
}

export interface RulesStorageDoc {
  rules: unknown[];
}

/** Normalize rules storage: v2 envelope, `{ rules }`, or legacy bare array. */
export function normalizeRulesStorageDoc(raw: unknown): RulesStorageDoc {
  const unwrapped = unwrapStorageDoc<RulesStorageDoc | unknown[]>(raw);
  if (!unwrapped) return { rules: [] };
  if (Array.isArray(unwrapped)) return { rules: unwrapped };
  if (typeof unwrapped === 'object' && Array.isArray((unwrapped as RulesStorageDoc).rules)) {
    return { rules: (unwrapped as RulesStorageDoc).rules };
  }
  return { rules: [] };
}
