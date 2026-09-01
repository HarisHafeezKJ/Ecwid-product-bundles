import crypto from 'node:crypto';
import type { Request } from 'express';

export interface EcwidIframePayload {
  store_id: number;
  lang?: string;
  access_token: string;
  public_token?: string;
  view_mode?: string;
  app_state?: string;
}

/** Normalize Ecwid url-safe base64 payload from query strings. */
export function normalizeEcwidPayloadInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    return decodeURIComponent(trimmed).replace(/ /g, '+');
  } catch {
    return trimmed.replace(/ /g, '+');
  }
}

function decodeEcwidPayloadBase64(data: string): Buffer {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

/** Read `payload` from Express query or raw URL (fallback if the parser corrupts long values). */
export function extractEcwidPayloadParam(req: Request): string {
  const fromQuery = req.query.payload;
  if (typeof fromQuery === 'string') {
    const normalized = normalizeEcwidPayloadInput(fromQuery);
    if (normalized) return normalized;
  }

  const query = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1]! : '';
  const match = query.match(/(?:^|&)payload=([^&]*)/);
  if (!match?.[1]) return '';
  return normalizeEcwidPayloadInput(match[1]);
}

/** Decrypt Ecwid native-app iframe `payload` query param (AES-128-CBC). */
export function decryptEcwidPayload(encrypted: string, clientSecret: string): EcwidIframePayload {
  const key = Buffer.from(clientSecret.slice(0, 16), 'utf8');
  const decoded = decodeEcwidPayloadBase64(encrypted);
  if (decoded.length <= 16) {
    throw new Error('Ecwid payload is too short');
  }

  const iv = decoded.subarray(0, 16);
  const ciphertext = decoded.subarray(16);
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  const parsed = JSON.parse(json) as EcwidIframePayload;

  if (!parsed.store_id || !parsed.access_token) {
    throw new Error('Ecwid payload missing store_id or access_token');
  }

  return parsed;
}

export function describeEcwidPayloadDecryptError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('bad decrypt') || err.message.includes('wrong final block length')) {
      return 'decrypt_bad_key';
    }
    return err.message;
  }
  return 'unknown_decrypt_error';
}
