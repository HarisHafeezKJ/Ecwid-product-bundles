import { Router } from 'express';
import { calculateCartDiscounts, type EcwidDiscountCartItem } from '../../lib/cart-discount.js';
import { resolveWebhookRules } from '../../lib/storefront-rules.js';

export const discountWebhookRouter = Router();

function parseDiscountCartItems(raw: unknown[]): EcwidDiscountCartItem[] {
  return raw.map((entry) => {
    const row = entry as Record<string, unknown>;
    const qty = Math.max(0, Number(row.amount ?? row.quantity ?? 0));
    const productPrice = Number(row.productPrice ?? row.priceInProductList ?? row.price ?? 0);
    return {
      productId: Number(row.productId ?? 0),
      amount: qty,
      quantity: qty,
      productPrice,
      price: Number(row.price ?? productPrice),
    };
  });
}

discountWebhookRouter.post('/', async (req, res) => {
  try {
    const storeId = String(req.body?.storeId ?? '').trim();
    if (!storeId) {
      res.status(400).json({ discounts: [] });
      return;
    }

    const rawItems = Array.isArray(req.body?.cart?.items) ? req.body.cart.items : [];
    const items = parseDiscountCartItems(rawItems).filter(
      (item) => item.productId > 0 && (item.amount ?? 0) > 0,
    );

    const rules = await resolveWebhookRules(storeId, req.body?.merchantAppSettings);
    if (!rules.length) {
      console.warn('[pb-discount-webhook] no active rules for store', storeId);
      res.status(200).json({ discounts: [] });
      return;
    }

    const result = calculateCartDiscounts(rules, items);
    res.status(200).json(result);
  } catch (err) {
    console.error('[pb-discount-webhook] error', err);
    res.status(200).json({ discounts: [] });
  }
});
