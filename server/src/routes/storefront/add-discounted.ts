import { Router } from 'express';
import type { BundleRule } from '@pb/shared';
import { parseBundleItems } from '@pb/shared';
import { addToCart } from '../../lib/ecwid.js';
import { pricedLinesToEcwidCartLines } from '../../lib/ecwid-cart-lines.js';
import { priceLinesForRule, type PriceLineInput } from '../../lib/price-lines-for-rule.js';
import { resolveStorefrontBundleRule } from '../../lib/storefront-rules.js';
import { CLIENT_ERRORS, corsHeaders, failResponse, jsonResponse } from '../../lib/api-response.js';
import { resolveStorefrontTokens } from '../../lib/storefront-tokens.js';
import { requireStoreId } from '../../lib/store-context.js';

function normalizeClientLines(lines: unknown[]): PriceLineInput[] {
  return lines.map((line) => {
    const row = line as Record<string, unknown>;
    const variantId = row.variantId ? String(row.variantId).trim() : '';
    return {
      productId: String(row.productId ?? ''),
      variantId: variantId || undefined,
      quantity: Math.max(1, Number(row.quantity ?? 1)),
    };
  });
}

function expandLinesForRule(rule: BundleRule, clientLines: PriceLineInput[]): PriceLineInput[] {
  if (rule.ruleType !== 'FIXED_BUNDLE') return clientLines;

  const components = parseBundleItems(rule.items).components;
  if (components.length < 2) return clientLines;

  const expanded: PriceLineInput[] = [];
  for (const component of components) {
    const hits = clientLines.filter((line) => line.productId === component.productId);
    if (hits.length === 0) {
      expanded.push({
        productId: component.productId,
        quantity: Math.max(1, component.minQuantity ?? 1),
        variantId:
          component.adminLocksVariant && component.defaultVariantId
            ? component.defaultVariantId
            : undefined,
      });
      continue;
    }
    for (const hit of hits) {
      expanded.push({
        productId: component.productId,
        quantity: Math.max(1, hit.quantity),
        variantId:
          hit.variantId ??
          (component.adminLocksVariant && component.defaultVariantId
            ? component.defaultVariantId
            : undefined),
      });
    }
  }
  return expanded;
}

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

    const tokens = await resolveStorefrontTokens(
      storeId,
      String(req.body?.publicToken ?? req.query.publicToken ?? '').trim() || undefined,
    );
    if (!tokens) return failResponse(res, req, 'Store not found', 404);

    const rule = await resolveStorefrontBundleRule(
      storeId,
      ruleId,
      tokens,
      req.body?.publicConfig,
    );
    if (!rule || rule.status !== 'ACTIVE') return failResponse(res, req, 'Rule not found', 404);

    const normalized = expandLinesForRule(rule, normalizeClientLines(lines));

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

    const ecwidLines = pricedLinesToEcwidCartLines(priced);

    jsonResponse(res, req, {
      ok: true,
      cartId: result.cartId,
      lines: priced,
      ecwidLines,
      serverAdded: result.addedCount >= priced.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not add to cart';
    const status = CLIENT_ERRORS.has(message) ? 400 : 500;
    failResponse(res, req, message, status);
  }
});
