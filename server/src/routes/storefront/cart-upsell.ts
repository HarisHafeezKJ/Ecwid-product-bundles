import { Router } from 'express';
import type { CartLineSnapshot } from '@pb/shared';
import { listActiveRulesForStore } from '../../lib/db/rules.js';
import { loadAppSettings } from '../../lib/db/settings.js';
import { buildCartUpsellView } from '../../lib/build-cart-upsell.js';
import { serializeCartUpsellOffer } from '../../lib/serialize-cart-upsell.js';
import { corsHeaders, jsonResponse } from '../../lib/api-response.js';
import { getStoreTokens } from '../../lib/auth.js';
import { getStoreCurrency } from '../../lib/store-currency.js';
import { requireStoreId } from '../../lib/store-context.js';

function parseProductIds(req: { query: Record<string, unknown>; body?: Record<string, unknown> }): string[] {
  const raw =
    req.query.productIds ??
    req.query.productId ??
    req.body?.productIds ??
    req.body?.productId;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).slice(0, 50);
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
  }
  return [];
}

function linesFromBody(body: Record<string, unknown> | undefined): CartLineSnapshot[] {
  if (!body || !Array.isArray(body.lines)) return [];
  return body.lines.map((line) => {
    const row = line as Record<string, unknown>;
    return {
      lineId: row.lineId ? String(row.lineId) : undefined,
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

async function handleCartUpsell(
  req: import('express').Request,
  res: import('express').Response,
): Promise<void> {
  try {
    const storeId = requireStoreId(req);
    const settings = await loadAppSettings(storeId);
    if (!settings.cartUpsellEnabled) {
      res.status(204).set(corsHeaders(req)).end();
      return;
    }

    const tokens = await getStoreTokens(storeId);
    if (!tokens) {
      res.status(204).set(corsHeaders(req)).end();
      return;
    }

    const productIds = parseProductIds(req);
    const bodyLines = linesFromBody(req.body as Record<string, unknown>);
    const lines: CartLineSnapshot[] =
      bodyLines.length > 0
        ? bodyLines
        : productIds.map((productId) => ({
            productId,
            quantity: 1,
            unitPrice: 0,
            catalogPrice: 0,
          }));

    if (lines.length === 0) {
      res.status(204).set(corsHeaders(req)).end();
      return;
    }

    const rules = await listActiveRulesForStore(storeId, 'CART_UPSELL');
    const view = await buildCartUpsellView(tokens, rules, lines);
    if (!view) {
      res.status(204).set(corsHeaders(req)).end();
      return;
    }

    const currency = await getStoreCurrency(tokens, settings.currency);

    jsonResponse(res, req, { offers: [serializeCartUpsellOffer(view)], enabled: true, currency });
  } catch (err) {
    console.error('cart-upsell error', err);
    res.status(204).set(corsHeaders(req)).end();
  }
}

export const cartUpsellRouter = Router();

cartUpsellRouter.options('/', (req, res) => {
  res.status(204).set(corsHeaders(req)).end();
});

cartUpsellRouter.get('/', handleCartUpsell);
cartUpsellRouter.post('/', handleCartUpsell);
