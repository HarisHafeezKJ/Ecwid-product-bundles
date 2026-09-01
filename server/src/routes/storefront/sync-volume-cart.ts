import { Router } from 'express';
import { syncVolumeCart } from '../../lib/volume-cart-sync.js';
import { corsHeaders, failResponse, jsonResponse } from '../../lib/api-response.js';
import { resolveRules } from '../../lib/storefront-rules.js';
import { resolveStorefrontTokens } from '../../lib/storefront-tokens.js';
import { requireStoreId } from '../../lib/store-context.js';
import { parseSyncVolumeCartBody } from '../../lib/validate-body.js';

export const syncVolumeCartRouter = Router();

syncVolumeCartRouter.options('/', (req, res) => {
  res.status(204).set(corsHeaders(req)).end();
});

syncVolumeCartRouter.post('/', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const parsed = parseSyncVolumeCartBody({ ...req.query, ...(req.body as object | undefined) });
    if (!parsed.ok) return failResponse(res, req, parsed.error, 400);

    const { cartId, publicToken, lines } = parsed.data;
    const tokens = await resolveStorefrontTokens(storeId, publicToken || undefined);
    if (!tokens) {
      jsonResponse(res, req, { ok: true, updated: 0 });
      return;
    }

    const { rules } = await resolveRules({ storeId, tokens });
    const { updated } = await syncVolumeCart(tokens, rules, lines);

    jsonResponse(res, req, {
      ok: true,
      updated: updated.length,
      cartId,
    });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Cart sync failed', 500);
  }
});
