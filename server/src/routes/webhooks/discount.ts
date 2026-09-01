import { Router } from 'express';
import { listActiveRulesForStore } from '../../lib/db/rules.js';
import { calculateCartDiscounts, type EcwidDiscountCartItem } from '../../lib/cart-discount.js';

export const discountWebhookRouter = Router();

discountWebhookRouter.post('/', async (req, res) => {
  try {
    const storeId = String(req.body?.storeId ?? '').trim();
    if (!storeId) {
      res.status(400).json({ discounts: [] });
      return;
    }

    const rawItems = Array.isArray(req.body?.cart?.items) ? req.body.cart.items : [];
    const items: EcwidDiscountCartItem[] = rawItems.map((item: Record<string, unknown>) => ({
      productId: Number(item.productId ?? 0),
      amount: Number(item.amount ?? item.quantity ?? 0),
      quantity: Number(item.quantity ?? item.amount ?? 0),
      productPrice: Number(item.productPrice ?? item.price ?? 0),
      price: Number(item.price ?? item.productPrice ?? 0),
    }));

    const rules = await listActiveRulesForStore(storeId);
    const result = calculateCartDiscounts(rules, items);
    res.status(200).json(result);
  } catch (err) {
    console.error('[pb-discount-webhook] error', err);
    res.status(200).json({ discounts: [] });
  }
});
