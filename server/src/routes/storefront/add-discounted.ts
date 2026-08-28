import { Router } from 'express';
import { getBundleRule } from '../../lib/db/rules.js';
import { addToCart } from '../../lib/ecwid.js';
import { priceLinesForRule } from '../../lib/price-lines-for-rule.js';
import { CLIENT_ERRORS, corsHeaders, failResponse, jsonResponse } from '../../lib/api-response.js';
import { getStoreTokens } from '../../lib/auth.js';
import { requireStoreId } from '../../lib/store-context.js';

export const addDiscountedRouter = Router();

addDiscountedRouter.options('/', (req, res) => {
  res.status(204).set(corsHeaders(req)).end();
});

addDiscountedRouter.post('/', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const ruleId = String(req.body?.ruleId ?? '').trim();
    const cartId = String(req.body?.cartId ?? '').trim() || undefined;
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];

    if (!ruleId) return failResponse(res, req, 'ruleId is required', 400);
    if (lines.length === 0) return failResponse(res, req, 'lines are required', 400);

    const tokens = await getStoreTokens(storeId);
    if (!tokens) return failResponse(res, req, 'Store not found', 404);

    const rule = await getBundleRule(storeId, ruleId);
    if (!rule || rule.status !== 'ACTIVE') return failResponse(res, req, 'Rule not found', 404);

    const normalized = lines.map((line: Record<string, unknown>) => ({
      productId: String(line.productId ?? ''),
      variantId: line.variantId ? String(line.variantId) : undefined,
      quantity: Math.max(1, Number(line.quantity ?? 1)),
    }));

    const priced = await priceLinesForRule(tokens, rule, normalized);
    const result = await addToCart(
      tokens,
      cartId,
      priced.map((p) => ({
        productId: p.productId,
        variantId: p.variantId,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        options: p.options,
      })),
    );

    jsonResponse(res, req, {
      ok: true,
      cartId: result.cartId,
      lines: priced,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not add to cart';
    const status = CLIENT_ERRORS.has(message) ? 400 : 500;
    failResponse(res, req, message, status);
  }
});
