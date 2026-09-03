import type { BundleRule, CartLineSnapshot } from '@pb/shared';
import {
  cartQtyForProduct,
  discountDisplayName,
  exactVolumeTier,
  isRuleEligible,
  isTierDiscountable,
  lineItemsToCartQty,
  mixMatchCartQty,
  mixPoolProductIds,
  readStampFromOptions,
  bestVolumeTier,
} from '@pb/shared';
import type { EcwidStoreTokens } from './ecwid.js';
import { primeProductCache, priceLinesForRule, type ProductCache } from './price-lines-for-rule.js';

export interface LinePlan {
  lineIndex: number;
  action: 'update' | 'remove' | 'keep';
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  catalogPrice: number;
  options?: Record<string, string>;
}

export function parseCartCatalogLines(items: CartLineSnapshot[]): CartLineSnapshot[] {
  return items.map((item) => {
    const stamp = readStampFromOptions(item.options);
    return {
      ...item,
      offerId: item.offerId ?? stamp.offerId,
      dealId: item.dealId ?? stamp.dealId,
    };
  });
}

function productInEligibleFixedBundle(
  productId: string,
  rules: BundleRule[],
  lines: CartLineSnapshot[],
): boolean {
  return rules.some(
    (rule) =>
      rule.ruleType === 'FIXED_BUNDLE' &&
      rule.status === 'ACTIVE' &&
      isRuleEligible(rule, lines) &&
      (rule.items?.components ?? []).some((c) => c.productId === productId),
  );
}

export async function syncVolumeCart(
  tokens: EcwidStoreTokens,
  rules: BundleRule[],
  lines: CartLineSnapshot[],
): Promise<{ updated: LinePlan[] }> {
  const parsed = parseCartCatalogLines(lines);
  const plans: LinePlan[] = [];

  // Every line goes through `priceLinesForRule` individually; without a shared
  // cache each one made its own catalog round-trip. Prefetch the whole cart's
  // products in a single batch and reuse the cache for every rule pricing call.
  const cache: ProductCache = new Map();
  await primeProductCache(tokens, parsed.map((line) => line.productId), cache);

  for (let i = 0; i < parsed.length; i++) {
    const line = parsed[i]!;
    const stamp = readStampFromOptions(line.options);
    const offerId = line.offerId ?? stamp.offerId;

    if (!offerId) {
      plans.push({
        lineIndex: i,
        action: 'keep',
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        catalogPrice: line.catalogPrice,
        options: line.options,
      });
      continue;
    }

    const rule = rules.find((r) => r.id === offerId || discountDisplayName(r) === offerId);
    if (!rule || rule.status !== 'ACTIVE') {
      plans.push({
        lineIndex: i,
        action: 'update',
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        unitPrice: line.catalogPrice,
        catalogPrice: line.catalogPrice,
        options: {},
      });
      continue;
    }

    if (productInEligibleFixedBundle(line.productId, rules, parsed)) {
      plans.push({
        lineIndex: i,
        action: 'keep',
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        catalogPrice: line.catalogPrice,
        options: line.options,
      });
      continue;
    }

    if (rule.ruleType === 'VOLUME_DISCOUNT') {
      const tiers = (rule.volumeTiers?.tiers ?? []).filter(isTierDiscountable);
      const ruleLabel = discountDisplayName(rule);
      const offerLines = parsed.filter((row) => {
        const rowOfferId = row.offerId ?? readStampFromOptions(row.options).offerId;
        return (rowOfferId === offerId || rowOfferId === rule.id || rowOfferId === ruleLabel) && row.productId === line.productId;
      });
      const totalQty = offerLines.reduce((sum, row) => sum + row.quantity, 0);
      const tier = exactVolumeTier(tiers, totalQty);
      if (!tier) {
        plans.push({
          lineIndex: i,
          action: 'update',
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: line.catalogPrice,
          catalogPrice: line.catalogPrice,
          options: {},
        });
        continue;
      }

      const priced = await priceLinesForRule(
        tokens,
        rule,
        [
          {
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          },
        ],
        cache,
      );
      const p = priced[0]!;
      plans.push({
        lineIndex: i,
        action: 'update',
        productId: p.productId,
        variantId: p.variantId,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        catalogPrice: p.catalogPrice,
        options: p.options,
      });
      continue;
    }

    if (rule.ruleType === 'MIX_AND_MATCH') {
      const pool = mixPoolProductIds(rule);
      const mixQty = mixMatchCartQty(parsed, pool);
      const tier = bestVolumeTier(rule.volumeTiers?.tiers ?? [], mixQty);
      if (!tier || !pool.includes(line.productId)) {
        plans.push({
          lineIndex: i,
          action: 'update',
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          unitPrice: line.catalogPrice,
          catalogPrice: line.catalogPrice,
          options: {},
        });
        continue;
      }

      const priced = await priceLinesForRule(
        tokens,
        rule,
        [
          {
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          },
        ],
        cache,
      );
      const p = priced[0]!;
      plans.push({
        lineIndex: i,
        action: 'update',
        productId: p.productId,
        variantId: p.variantId,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        catalogPrice: p.catalogPrice,
        options: p.options,
      });
      continue;
    }

    plans.push({
      lineIndex: i,
      action: 'keep',
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      catalogPrice: line.catalogPrice,
      options: line.options,
    });
  }

  return { updated: plans.filter((p) => p.action !== 'keep') };
}

// Re-export helpers used by tests / future routes
export { lineItemsToCartQty, cartQtyForProduct };
