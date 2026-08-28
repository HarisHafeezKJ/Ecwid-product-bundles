import { Router } from 'express';
import type { CartLineSnapshot } from '@pb/shared';
import { listActiveRulesForStore } from '../../lib/db/rules.js';
import { syncVolumeCart } from '../../lib/volume-cart-sync.js';
import { corsHeaders, failResponse, jsonResponse } from '../../lib/api-response.js';
import { getStoreTokens } from '../../lib/auth.js';
import { requireStoreId } from '../../lib/store-context.js';

function linesFromBody(body: Record<string, unknown> | undefined): CartLineSnapshot[] {
  if (!body || !Array.isArray(body.lines)) return [];
  return body.lines.map((line, index) => {
    const row = line as Record<string, unknown>;
    return {
      lineId: row.lineId ? String(row.lineId) : String(index),
      productId: String(row.productId ?? ''),
      variantId: row.variantId ? String(row.variantId) : undefined,
      quantity: Math.max(0, Number(row.quantity ?? 0)),
      unitPrice: Number(row.unitPrice ?? row.price ?? 0),
      catalogPrice: Number(row.catalogPrice ?? row.productPrice ?? row.unitPrice ?? 0),
      offerId: row.offerId ? String(row.offerId) : undefined,
      dealId: row.dealId ? String(row.dealId) : undefined,
      options:
        row.options && typeof row.options === 'object'
          ? (row.options as Record<string, string>)
          : undefined,
    };
  });
}

export const syncVolumeCartRouter = Router();

syncVolumeCartRouter.options('/', (req, res) => {
  res.status(204).set(corsHeaders(req)).end();
});

syncVolumeCartRouter.post('/', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const tokens = await getStoreTokens(storeId);
    if (!tokens) return failResponse(res, req, 'Store not found', 404);

    const lines = linesFromBody(req.body);
    const rules = await listActiveRulesForStore(storeId);
    const { updated } = await syncVolumeCart(tokens, rules, lines);

    jsonResponse(res, req, { ok: true, updated, cartId: req.body?.cartId });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Cart sync failed', 500);
  }
});
