import { Router } from 'express';
import { calculateCartDiscounts, type EcwidDiscountCartItem } from '../../lib/cart-discount.js';
import { resolveWebhookRules } from '../../lib/storefront-rules.js';
import { verifyDiscountWebhookStore } from '../../lib/webhook-verify.js';

export const discountWebhookRouter = Router();

function parseDiscountCartItems(raw: unknown[]): EcwidDiscountCartItem[] {
  return raw.map((entry) => {
    const row = entry as Record<string, unknown>;
    const qty = Math.max(0, Number(row.amount ?? row.quantity ?? 0));
    const priceInProductList = Number(row.priceInProductList ?? 0);
    const productPrice = Number(row.productPrice ?? 0);
    const price = Number(row.price ?? 0);
    const selectedOptions = row.selectedOptions;
    const flatOptions =
      row.options && typeof row.options === 'object' && !Array.isArray(row.options)
        ? (row.options as Record<string, string>)
        : undefined;
    return {
      productId: Number(row.productId ?? 0),
      amount: qty,
      quantity: qty,
      productPrice: productPrice > 0 ? productPrice : priceInProductList > 0 ? priceInProductList : 0,
      priceInProductList: priceInProductList > 0 ? priceInProductList : undefined,
      price: price > 0 ? price : productPrice > 0 ? productPrice : priceInProductList,
      selectedOptions,
      options: flatOptions,
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

    // A cold Vercel lambda has an empty token cache, so an install check alone would drop
    // every discount until the store re-authenticates. Embedded merchantAppSettings let the
    // request stand on its own: without resolvable rules the response is empty regardless.
    const merchantAppSettings = req.body?.merchantAppSettings;
    if (!merchantAppSettings && !(await verifyDiscountWebhookStore(storeId))) {
      console.warn('[pb-discount-webhook] unknown or uninstalled store', storeId);
      res.status(200).json({ discounts: [] });
      return;
    }

    const rawItems = Array.isArray(req.body?.cart?.items) ? req.body.cart.items : [];
    const items = parseDiscountCartItems(rawItems).filter(
      (item) => item.productId > 0 && (item.amount ?? 0) > 0,
    );

    const rules = await resolveWebhookRules(storeId, merchantAppSettings);
    if (!rules.length) {
      console.warn('[pb-discount-webhook] no active rules for store', storeId);
      res.status(200).json({ discounts: [] });
      return;
    }

    const result = calculateCartDiscounts(rules, items);

    if (items.length > 0 && result.discounts.length === 0) {
      console.warn('[pb-discount-webhook] no discounts for cart', {
        storeId,
        itemCount: items.length,
        productIds: items.map((i) => i.productId),
        samplePrices: items.slice(0, 3).map((i) => ({
          productId: i.productId,
          qty: i.amount,
          productPrice: i.productPrice,
          price: i.price,
        })),
      });
    }
    res.status(200).json(result);
  } catch (err) {
    console.error('[pb-discount-webhook] error', err);
    res.status(200).json({ discounts: [] });
  }
});
