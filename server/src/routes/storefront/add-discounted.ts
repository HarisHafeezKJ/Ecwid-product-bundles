import { Router } from 'express';
import type { BundleRule } from '@pb/shared';
import { parseBundleItems } from '@pb/shared';
import { pricedLinesToEcwidCartLines } from '../../lib/ecwid-cart-lines.js';
import { isPrivateStoreTokens, removeDealStampOption } from '../../lib/ecwid.js';
import { priceLinesForRule, type PriceLineInput } from '../../lib/price-lines-for-rule.js';
import { resolveStorefrontBundleRule } from '../../lib/storefront-rules.js';
import {
  CLIENT_ERRORS,
  corsHeaders,
  failResponse,
  isClientError,
  jsonResponse,
} from '../../lib/api-response.js';
import { resolveStorefrontTokens } from '../../lib/storefront-tokens.js';
import { getOAuthTokens } from '../../lib/storage/oauth-cache.js';
import { requireStoreId } from '../../lib/store-context.js';
import { parseAddDiscountedBody } from '../../lib/validate-body.js';

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
    const parsed = parseAddDiscountedBody({ ...req.query, ...(req.body as object | undefined) });
    if (!parsed.ok) return failResponse(res, req, parsed.error, 400);

    const { ruleId, cartId, lines, publicToken } = parsed.data;

    const tokens = await resolveStorefrontTokens(storeId, publicToken || undefined);
    if (!tokens) return failResponse(res, req, 'Store not found', 404);

    const rule = await resolveStorefrontBundleRule(storeId, ruleId, tokens);
    if (!rule || rule.status !== 'ACTIVE') return failResponse(res, req, 'Rule not found', 404);

    const normalized = expandLinesForRule(rule, normalizeClientLines(lines));

    const privateTokens = await getOAuthTokens(storeId);
    const catalogTokens =
      privateTokens && isPrivateStoreTokens(privateTokens) ? privateTokens : tokens;
    await removeDealStampOption(catalogTokens, [
      ...normalized.map((line) => line.productId),
      ...parseBundleItems(rule.items).components.map((c) => c.productId),
      rule.targetProductId,
      rule.primaryProductId,
    ].filter((id): id is string => Boolean(id)));

    const priced = await priceLinesForRule(tokens, rule, normalized);

    // Ecwid exposes no REST endpoint for writing to a live storefront cart — /carts only
    // reads and updates abandoned carts. The storefront applies these lines through
    // Ecwid.Cart.addProduct instead.
    jsonResponse(res, req, {
      ok: true,
      cartId,
      lines: priced,
      ecwidLines: pricedLinesToEcwidCartLines(priced),
      serverAdded: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not add to cart';
    const status = isClientError(err) || CLIENT_ERRORS.has(message) ? 400 : 500;
    failResponse(res, req, message, status);
  }
});
