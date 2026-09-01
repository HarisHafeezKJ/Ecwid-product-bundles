import crypto from 'node:crypto';
import type { Request } from 'express';
import { getEcwidClientSecret, isProduction } from './config.js';
import { ensureStoreTokens } from './storage/oauth-cache.js';

export function ecwidWebhookSignatureHeader(req: Request): string | undefined {
  const raw = req.headers['x-ecwid-webhook-signature'];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return undefined;
}

/** Verify Ecwid webhook-automation signatures (order/product events). */
export function verifyEcwidWebhookSignature(
  signatureHeader: string | undefined,
  eventCreated: unknown,
  eventId: unknown,
): boolean {
  if (!signatureHeader || eventCreated == null || eventId == null) return false;

  const message = `${eventCreated}.${eventId}`;
  const expected = crypto
    .createHmac('sha256', getEcwidClientSecret())
    .update(message)
    .digest('base64');

  const received = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);
  if (received.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(received, expectedBuf);
}

export function shouldVerifyWebhooks(): boolean {
  if (isProduction()) return true;
  return process.env.WEBHOOK_SKIP_VERIFY !== 'true';
}

/** discountUrl has no Ecwid signature — ensure the store installed this app. */
export async function verifyDiscountWebhookStore(storeId: string): Promise<boolean> {
  if (!storeId) return false;
  const tokens = await ensureStoreTokens(storeId);
  return Boolean(tokens?.accessToken);
}
