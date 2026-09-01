import { Router } from 'express';
import type { CartLineSnapshot } from '@pb/shared';
import { listActiveRulesForStore } from '../../lib/db/rules.js';
import {
  listActiveRulesFromEmbeddedPublicConfig,
  listActiveRulesFromPublicConfig,
} from '../../lib/db/public-rules.js';
import { syncVolumeCart } from '../../lib/volume-cart-sync.js';
import { corsHeaders, failResponse, jsonResponse } from '../../lib/api-response.js';
import { resolveStorefrontTokens } from '../../lib/storefront-tokens.js';
import { getOAuthTokens } from '../../lib/storage/oauth-cache.js';
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
    const publicToken = String(req.body?.publicToken ?? req.query.publicToken ?? '').trim();
    const cachedPrivate = await getOAuthTokens(storeId);
    const tokens = await resolveStorefrontTokens(storeId, publicToken || undefined);
    if (!tokens) {
      jsonResponse(res, req, { ok: true, updated: 0 });
      return;
    }

    const lines = linesFromBody(req.body);
    if (lines.length === 0) {
      jsonResponse(res, req, { ok: true, updated: 0 });
      return;
    }

    const usePublicRules = Boolean(publicToken) && !cachedPrivate?.accessToken;
    let rules: Awaited<ReturnType<typeof listActiveRulesForStore>> = [];
    if (!usePublicRules && cachedPrivate?.accessToken) {
      try {
        rules = await listActiveRulesForStore(storeId);
      } catch (err) {
        console.warn('[pb-sync-volume-cart] listActiveRulesForStore failed', err);
      }
    }
    if (rules.length === 0) {
      try {
        rules = await listActiveRulesFromPublicConfig(tokens);
      } catch (err) {
        console.warn('[pb-sync-volume-cart] listActiveRulesFromPublicConfig failed', err);
      }
    }
    if (rules.length === 0 && req.body?.publicConfig) {
      rules = listActiveRulesFromEmbeddedPublicConfig(req.body.publicConfig);
    }
    const { updated } = await syncVolumeCart(tokens, rules, lines);

    jsonResponse(res, req, {
      ok: true,
      updated: updated.length,
      cartId: req.body?.cartId,
    });
  } catch (err) {
    failResponse(res, req, err instanceof Error ? err.message : 'Cart sync failed', 500);
  }
});
