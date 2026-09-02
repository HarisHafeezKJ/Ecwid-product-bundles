import { exactVolumeTier, mixRequiredCount } from './volume-tiers.js';
import { mixPoolProductIds } from './rule-placement.js';
import type { BundleRule, CartQtyLine } from './types.js';

export function lineItemsToCartQty(lines: CartQtyLine[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const line of lines) {
    if (!line.productId) continue;
    map[line.productId] = (map[line.productId] ?? 0) + Math.max(0, line.quantity);
  }
  return map;
}

export function cartQtyForProduct(lines: CartQtyLine[], productId: string): number {
  return lines
    .filter((line) => line.productId === productId)
    .reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
}

export function mixMatchCartQty(
  lines: CartQtyLine[],
  poolIds: string[],
  collectionProductIds: string[] = [],
): number {
  const pool = new Set(
    poolIds.length > 0 ? poolIds : collectionProductIds.filter(Boolean),
  );
  return lines
    .filter((line) => pool.has(line.productId))
    .reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
}

export function isCartUpsellTriggered(rule: BundleRule, lines: CartQtyLine[]): boolean {
  if (rule.ruleType !== 'CART_UPSELL') return false;
  const triggers = new Set(rule.triggerProductIds.filter(Boolean));
  if (triggers.size === 0) return false;
  return lines.some((line) => triggers.has(line.productId) && line.quantity > 0);
}

export function uniqueVolumeRuleForProduct(
  rules: BundleRule[],
  productId: string,
): BundleRule | undefined {
  const matching = rules.filter(
    (rule) =>
      rule.ruleType === 'VOLUME_DISCOUNT' &&
      rule.status === 'ACTIVE' &&
      volumeRuleClaimsProduct(rule, productId),
  );
  if (matching.length === 1) return matching[0];
  return undefined;
}

function volumeRuleClaimsProduct(rule: BundleRule, productId: string): boolean {
  if (rule.applyToAllProducts) return true;
  const targets = (rule.items?.components ?? []).map((item) => item.productId).filter(Boolean);
  return targets.includes(productId);
}

/** Number of complete fixed-bundle sets present in the cart (limited by scarcest component). */
export function fixedBundleCompleteCount(rule: BundleRule, lines: CartQtyLine[]): number {
  const items = rule.items?.components ?? [];
  if (items.length < 2) return 0;

  const counts = items.map((item) => {
    const minQty = Math.max(1, item.minQuantity ?? 1);
    const cartQty = cartQtyForProduct(lines, item.productId);
    return Math.floor(cartQty / minQty);
  });

  return Math.min(...counts);
}

function isFixedBundleEligible(rule: BundleRule, lines: CartQtyLine[]): boolean {
  return fixedBundleCompleteCount(rule, lines) > 0;
}

function isVolumeDiscountEligible(rule: BundleRule, lines: CartQtyLine[]): boolean {
  const tiers = rule.volumeTiers?.tiers ?? [];
  if (tiers.length === 0) return false;

  if (rule.applyToAllProducts) {
    return lines.some((line) => exactVolumeTier(tiers, line.quantity) != null);
  }

  const targets = new Set(
    (rule.items?.components ?? []).map((item) => item.productId).filter(Boolean),
  );
  return lines.some(
    (line) =>
      targets.has(line.productId) && exactVolumeTier(tiers, line.quantity) != null,
  );
}

function isMixAndMatchEligible(
  rule: BundleRule,
  lines: CartQtyLine[],
  collectionProductIds: string[] = [],
): boolean {
  const pool = mixPoolProductIds(rule, collectionProductIds);
  if (pool.length === 0) return false;
  const required = mixRequiredCount(rule);
  return mixMatchCartQty(lines, pool, collectionProductIds) >= required;
}

export function isRuleEligible(
  rule: BundleRule,
  lines: CartQtyLine[],
  options: { collectionProductIds?: string[] } = {},
): boolean {
  if (rule.status !== 'ACTIVE') return false;

  switch (rule.ruleType) {
    case 'FIXED_BUNDLE':
      return isFixedBundleEligible(rule, lines);
    case 'VOLUME_DISCOUNT':
      return isVolumeDiscountEligible(rule, lines);
    case 'MIX_AND_MATCH':
      return isMixAndMatchEligible(rule, lines, options.collectionProductIds);
    case 'CART_UPSELL':
      return isCartUpsellTriggered(rule, lines);
    default:
      return false;
  }
}
