import { Router } from 'express';
import type { CartLineSnapshot } from '@pb/shared';
import { readStampFromOptions } from '@pb/shared';
import { listActiveRulesForStore } from '../../lib/db/rules.js';
import { attributeOrder } from '../../lib/order-attribution.js';
import { getOrder } from '../../lib/ecwid.js';
import { failResponse, jsonResponse } from '../../lib/api-response.js';
import { ensureStoreTokens } from '../../lib/storage/oauth-cache.js';
import {
  ecwidWebhookSignatureHeader,
  shouldVerifyWebhooks,
  verifyEcwidWebhookSignature,
} from '../../lib/webhook-verify.js';

export const ordersWebhookRouter = Router();

interface EcwidWebhookEnvelope {
  eventId?: string;
  eventCreated?: number | string;
  storeId?: number | string;
  entityId?: number | string;
  eventType?: string;
  data?: Record<string, unknown>;
}

function mapOrderItems(items: unknown[]): CartLineSnapshot[] {
  return items.map((entry, index) => {
    const item = entry as Record<string, unknown>;
    const options: Record<string, string> = {};
    const selected = Array.isArray(item.selectedOptions) ? item.selectedOptions : [];
    for (const opt of selected) {
      const row = opt as Record<string, unknown>;
      const name = String(row.name ?? '');
      const value = String(row.value ?? row.selection ?? '');
      if (name) options[name] = value;
    }
    const stamp = readStampFromOptions(options);
    return {
      lineId: String(item.id ?? index),
      productId: String(item.productId ?? ''),
      variantId: item.combinationId ? String(item.combinationId) : undefined,
      quantity: Math.max(1, Number(item.amount ?? item.quantity ?? 1)),
      unitPrice: Number(item.price ?? 0),
      catalogPrice: Number(item.productPrice ?? item.price ?? 0),
      offerId: stamp.offerId,
      dealId: stamp.dealId,
      options,
    };
  });
}

function orderIdFromWebhook(body: EcwidWebhookEnvelope): string | undefined {
  const fromData = body.data?.orderId ?? body.data?.vendorOrderNumber;
  if (fromData != null && String(fromData).trim()) return String(fromData).trim();
  if (body.entityId != null && String(body.entityId).trim()) return String(body.entityId).trim();
  return undefined;
}

ordersWebhookRouter.post('/', async (req, res) => {
  try {
    const body = (req.body ?? {}) as EcwidWebhookEnvelope & Record<string, unknown>;

    if (body.eventId && body.eventCreated != null && body.eventType) {
      if (shouldVerifyWebhooks()) {
        const signature = ecwidWebhookSignatureHeader(req);
        if (!verifyEcwidWebhookSignature(signature, body.eventCreated, body.eventId)) {
          console.warn('[pb-orders-webhook] invalid signature', {
            storeId: body.storeId,
            eventType: body.eventType,
          });
          res.status(401).json({ ok: false, error: 'Invalid webhook signature' });
          return;
        }
      }

      if (body.eventType !== 'order.created') {
        jsonResponse(res, req, { ok: true, ignored: true });
        return;
      }

      const storeId = String(body.storeId ?? '').trim();
      const orderId = orderIdFromWebhook(body);
      if (!storeId || !orderId) {
        failResponse(res, req, 'storeId and orderId are required', 400);
        return;
      }

      const tokens = await ensureStoreTokens(storeId);
      if (!tokens?.accessToken) {
        console.warn('[pb-orders-webhook] no tokens for store', storeId);
        jsonResponse(res, req, { ok: true, skipped: true });
        return;
      }

      const order = await getOrder(tokens, orderId);
      const items = Array.isArray(order.items) ? order.items : [];
      const lines = mapOrderItems(items);
      const orderTotal = Number(order.total ?? order.orderTotal ?? 0);
      const rules = await listActiveRulesForStore(storeId);
      await attributeOrder(storeId, orderId, lines, orderTotal, rules);
      jsonResponse(res, req, { ok: true });
      return;
    }

    // Legacy direct-order payload (unsigned) — reject in production.
    if (shouldVerifyWebhooks()) {
      res.status(400).json({ ok: false, error: 'Unsupported webhook payload' });
      return;
    }

    const storeId = String(body.storeId ?? req.headers['x-ecwid-store-id'] ?? '').trim();
    const orderId = String(body.orderId ?? body.id ?? body.vendorOrderNumber ?? '').trim();
    if (!storeId || !orderId) return failResponse(res, req, 'orderId is required', 400);

    const items = Array.isArray(body.items) ? body.items : [];
    const lines = mapOrderItems(items);
    const orderTotal = Number(body.total ?? body.orderTotal ?? 0);
    const rules = await listActiveRulesForStore(storeId);
    await attributeOrder(storeId, orderId, lines, orderTotal, rules);
    jsonResponse(res, req, { ok: true });
  } catch (err) {
    console.error('order webhook error', err);
    failResponse(res, req, err instanceof Error ? err.message : 'Webhook failed', 500);
  }
});
