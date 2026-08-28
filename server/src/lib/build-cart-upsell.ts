import type { BundleRule, CartLineSnapshot, CartUpsellView, CatalogProduct } from '@pb/shared';
import { checkoutCtaLabel, isCartUpsellTriggered } from '@pb/shared';
import type { EcwidStoreTokens } from './ecwid.js';
import { getProducts } from './ecwid.js';

const STOCK_THRESHOLD = 1;

function inStock(product: CatalogProduct): boolean {
  if (!product.inStock) return false;
  if (product.variants?.length) {
    return product.variants.some((v) => v.inStock && (v.quantity ?? STOCK_THRESHOLD) >= STOCK_THRESHOLD);
  }
  return (product.quantity ?? STOCK_THRESHOLD) >= STOCK_THRESHOLD;
}

export async function buildCartUpsellView(
  tokens: EcwidStoreTokens,
  rules: BundleRule[],
  lines: CartLineSnapshot[],
): Promise<CartUpsellView | null> {
  const inCart = new Set(lines.filter((l) => l.quantity > 0).map((l) => l.productId));

  for (const rule of rules) {
    if (rule.ruleType !== 'CART_UPSELL' || rule.status !== 'ACTIVE') continue;
    if (!isCartUpsellTriggered(rule, lines)) continue;

    const suggestedIds =
      rule.suggestedProductIds.length > 0
        ? rule.suggestedProductIds
        : (rule.items?.components ?? []).map((c) => c.productId);

    const candidates = suggestedIds.filter((id) => !inCart.has(id));
    if (candidates.length === 0) continue;

    const products = (await getProducts(tokens, candidates)).filter(inStock);
    if (products.length === 0) continue;

    return {
      rule,
      suggested: products,
      checkoutCtaLabel: checkoutCtaLabel(1),
    };
  }

  return null;
}
