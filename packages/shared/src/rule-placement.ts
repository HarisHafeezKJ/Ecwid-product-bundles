import type { BundleRule } from './types.js';

export function inferApplyToAllProducts(rule: {
  applyToAllProducts?: boolean | null;
  displayOn?: BundleRule['displayOn'];
  primaryProductId?: string;
}): boolean {
  if (rule.applyToAllProducts != null) return rule.applyToAllProducts;
  if (rule.displayOn === 'PRIMARY' && rule.primaryProductId) return false;
  return true;
}

export function mixPoolProductIds(
  rule: Pick<BundleRule, 'items' | 'sourceCollectionId'>,
  collectionProductIds: string[] = [],
): string[] {
  const fromItems = (rule.items?.components ?? [])
    .map((item) => item.productId)
    .filter(Boolean);
  if (fromItems.length > 0) return fromItems;
  if (rule.sourceCollectionId && collectionProductIds.length > 0) {
    return collectionProductIds.filter(Boolean);
  }
  return [];
}

export function ruleShowsOnProductPage(
  rule: BundleRule,
  productId: string,
  collectionProductIds: string[] = [],
): boolean {
  if (!productId || rule.ruleType === 'CART_UPSELL') return false;

  if (inferApplyToAllProducts(rule)) return true;

  if (rule.ruleType === 'MIX_AND_MATCH' || rule.ruleType === 'VOLUME_DISCOUNT') {
    const pool = mixPoolProductIds(rule, collectionProductIds);
    return (
      pool.some((id) => String(id) === String(productId)) ||
      String(rule.targetProductId ?? '') === String(productId) ||
      String(rule.primaryProductId ?? '') === String(productId)
    );
  }

  if (rule.ruleType === 'FIXED_BUNDLE') {
    const target = rule.targetProductId ?? rule.primaryProductId;
    return String(target ?? '') === String(productId);
  }

  return String(rule.targetProductId ?? '') === String(productId);
}
