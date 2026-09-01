import crypto from 'node:crypto';

export interface EcwidIframePayload {
  store_id: number;
  lang?: string;
  access_token: string;
  public_token?: string;
  view_mode?: string;
  app_state?: string;
}

/** Decrypt Ecwid native-app iframe `payload` query param (AES-128-CBC). */
export function decryptEcwidPayload(encrypted: string, clientSecret: string): EcwidIframePayload {
  const key = Buffer.from(clientSecret.slice(0, 16), 'utf8');
  const base64 = encrypted.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = Buffer.from(base64, 'base64');
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
