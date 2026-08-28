import { Router } from 'express';
import type { CartLineSnapshot } from '@pb/shared';
import { readStampFromOptions } from '@pb/shared';
import { listActiveRulesForStore } from '../../lib/db/rules.js';
import { attributeOrder } from '../../lib/order-attribution.js';
import { failResponse, jsonResponse } from '../../lib/api-response.js';
import { requireStoreId } from '../../lib/store-context.js';

export const ordersWebhookRouter = Router();

ordersWebhookRouter.post('/', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const payload = req.body ?? {};

    const orderId = String(
      payload.orderId ?? payload.id ?? payload.vendorOrderNumber ?? '',
    ).trim();
    if (!orderId) return failResponse(res, req, 'orderId is required', 400);

    const orderTotal = Number(payload.total ?? payload.orderTotal ?? 0);
    const items = Array.isArray(payload.items) ? payload.items : [];

    const lines: CartLineSnapshot[] = items.map((item: Record<string, unknown>, index: number) => {
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

    const rules = await listActiveRulesForStore(storeId);
    await attributeOrder(storeId, orderId, lines, orderTotal, rules);

    jsonResponse(res, req, { ok: true });
  } catch (err) {
    console.error('order webhook error', err);
    failResponse(res, req, err instanceof Error ? err.message : 'Webhook failed', 500);
  }
});
