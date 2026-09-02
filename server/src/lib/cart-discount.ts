import type { BundleRule, CartQtyLine } from '@pb/shared';
import {
  bestVolumeTier,
  bundleLineSale,
  discountDisplayName,
  exactVolumeTier,
  fixedBundleCompleteCount,
  isRuleEligible,
  isTierDiscountable,
  mixMatchCartQty,
  mixPoolProductIds,
  uniqueVolumeRuleForProduct,
  volumeUnitPrice,
} from '@pb/shared';

export interface EcwidDiscountCartItem {
  productId: number;
  amount?: number;
  quantity?: number;
  productPrice?: number;
  priceInProductList?: number;
  price?: number;
}

export interface EcwidCartDiscount {
  value: number;
  type: 'ABSOLUTE' | 'PERCENT';
  description: string;
  appliesToProducts?: number[];
}

export interface EcwidCartDiscountResponse {
  discounts: EcwidCartDiscount[];
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function cartLinesFromItems(items: EcwidDiscountCartItem[]): CartQtyLine[] {
  return items
    .map((item) => ({
      productId: String(item.productId ?? ''),
      quantity: Math.max(0, Number(item.amount ?? item.quantity ?? 0)),
    }))
    .filter((line) => line.productId && line.quantity > 0);
}

function unitPriceFromItem(
  item: EcwidDiscountCartItem,
  catalogHint?: number,
): number {
  const lineQty = Math.max(1, Number(item.amount ?? item.quantity ?? 1));
  const productPrice = Number(item.productPrice ?? item.priceInProductList ?? 0);
  if (productPrice > 0) return productPrice;

  const price = Number(item.price ?? 0);
  if (price <= 0) return catalogHint ?? 0;

  if (catalogHint != null && catalogHint > 0) {
    if (Math.abs(price - catalogHint) < 0.02) return catalogHint;
    if (lineQty > 1 && Math.abs(price - catalogHint * lineQty) < 0.02) return catalogHint;
  }

  return price;
}

function catalogUnitPrice(
  items: EcwidDiscountCartItem[],
  productId: string,
  catalogHint?: number,
): number {
  const pid = Number(productId);
  const hits = items.filter((item) => Number(item.productId) === pid);
  if (!hits.length) return catalogHint ?? 0;

  let total = 0;
  let qty = 0;
  for (const item of hits) {
    const lineQty = Math.max(0, Number(item.amount ?? item.quantity ?? 0));
    const unit = unitPriceFromItem(item, catalogHint);
    if (lineQty <= 0 || unit <= 0) continue;
    total += unit * lineQty;
    qty += lineQty;
  }
  if (qty > 0) return total / qty;
  return catalogHint ?? 0;
}

function fixedBundleDiscount(
  rule: BundleRule,
  items: EcwidDiscountCartItem[],
  lines: CartQtyLine[],
): EcwidCartDiscount | null {
  const bundleCount = fixedBundleCompleteCount(rule, lines);
  if (bundleCount <= 0) return null;

  const components = rule.items?.components ?? [];
  const productIds = components.map((c) => Number(c.productId)).filter((id) => id > 0);
  let savings = 0;

  for (const component of components) {
    const minQty = Math.max(1, component.minQuantity ?? 1);
    const qty = bundleCount * minQty;
    if (qty <= 0) continue;
    const catalogHint = component.price != null && component.price > 0 ? component.price : undefined;
    const catalog = catalogUnitPrice(items, component.productId, catalogHint);
    if (catalog <= 0) continue;
    const sale = bundleLineSale(catalog, rule.discountType, rule.discountValue);
    savings += Math.max(0, catalog - sale) * qty;
  }

  if (savings <= 0.001) return null;
  return {
    value: roundMoney(savings),
    type: 'ABSOLUTE',
    description: discountDisplayName(rule),
    appliesToProducts: productIds,
  };
}

function volumeDiscountForRule(
  rule: BundleRule,
  items: EcwidDiscountCartItem[],
  lines: CartQtyLine[],
): EcwidCartDiscount | null {
  const tiers = (rule.volumeTiers?.tiers ?? []).filter(isTierDiscountable);
  if (!tiers.length) return null;

  const pool = rule.applyToAllProducts
    ? null
    : new Set((rule.items?.components ?? []).map((c) => c.productId));

  const productIds: number[] = [];
  let savings = 0;

  for (const line of lines) {
    if (pool && !pool.has(line.productId) && line.productId !== rule.targetProductId) continue;
    const tier = exactVolumeTier(tiers, line.quantity);
    if (!tier) continue;

    const catalog = catalogUnitPrice(items, line.productId);
    if (catalog <= 0) continue;
    const sale = volumeUnitPrice(catalog, tier);
    const lineSavings = Math.max(0, catalog - sale) * line.quantity;
    if (lineSavings <= 0) continue;

    savings += lineSavings;
    const pid = Number(line.productId);
    if (pid > 0) productIds.push(pid);
  }

  if (savings <= 0.001) return null;
  return {
    value: roundMoney(savings),
    type: 'ABSOLUTE',
    description: discountDisplayName(rule),
    appliesToProducts: [...new Set(productIds)],
  };
}

function mixMatchDiscount(
  rule: BundleRule,
  items: EcwidDiscountCartItem[],
  lines: CartQtyLine[],
): EcwidCartDiscount | null {
  if (!isRuleEligible(rule, lines)) return null;

  const pool = mixPoolProductIds(rule);
  const tier = bestVolumeTier(rule.volumeTiers?.tiers ?? [], mixMatchCartQty(lines, pool));
  if (!tier) return null;

  const productIds: number[] = [];
  let savings = 0;

  for (const line of lines) {
    if (!pool.includes(line.productId)) continue;
    const catalog = catalogUnitPrice(items, line.productId);
    if (catalog <= 0) continue;
    const sale = volumeUnitPrice(catalog, tier);
    const lineSavings = Math.max(0, catalog - sale) * line.quantity;
    if (lineSavings <= 0) continue;

    savings += lineSavings;
    const pid = Number(line.productId);
    if (pid > 0) productIds.push(pid);
  }

  if (savings <= 0.001) return null;
  return {
    value: roundMoney(savings),
    type: 'ABSOLUTE',
    description: discountDisplayName(rule),
    appliesToProducts: [...new Set(productIds)],
  };
}

function productsInEligibleFixedBundle(
  rules: BundleRule[],
  lines: CartQtyLine[],
): Set<string> {
  const covered = new Set<string>();
  for (const rule of rules) {
    if (rule.ruleType !== 'FIXED_BUNDLE' || !isRuleEligible(rule, lines)) continue;
    for (const component of rule.items?.components ?? []) {
      covered.add(component.productId);
    }
  }
  return covered;
}

/** Assign each cart product to at most one volume rule (ambiguous overlaps apply none). */
function volumeDiscountsForLines(
  volumeRules: BundleRule[],
  items: EcwidDiscountCartItem[],
  lines: CartQtyLine[],
): EcwidCartDiscount[] {
  const discounts: EcwidCartDiscount[] = [];
  const linesByRule = new Map<string, CartQtyLine[]>();

  for (const line of lines) {
    const rule = uniqueVolumeRuleForProduct(volumeRules, line.productId);
    if (!rule) continue;
    const bucket = linesByRule.get(rule.id) ?? [];
    bucket.push(line);
    linesByRule.set(rule.id, bucket);
  }

  for (const rule of volumeRules) {
    const ruleLines = linesByRule.get(rule.id);
    if (!ruleLines?.length) continue;
    const discount = volumeDiscountForRule(rule, items, ruleLines);
    if (discount) discounts.push(discount);
  }

  return discounts;
}

/** Ecwid discountUrl handler — returns cart-level discounts for eligible bundle rules. */
export function calculateCartDiscounts(
  rules: BundleRule[],
  items: EcwidDiscountCartItem[],
): EcwidCartDiscountResponse {
  const lines = cartLinesFromItems(items);
  if (!lines.length) return { discounts: [] };

  const active = rules.filter((r) => r.status === 'ACTIVE' && r.ruleType !== 'CART_UPSELL');
  const discounts: EcwidCartDiscount[] = [];
  const fixedBundleProducts = productsInEligibleFixedBundle(active, lines);
  const volumeRules = active.filter((r) => r.ruleType === 'VOLUME_DISCOUNT');
  const volumeLines = lines.filter((line) => !fixedBundleProducts.has(line.productId));

  for (const rule of active) {
    if (rule.ruleType === 'FIXED_BUNDLE') {
      const discount = fixedBundleDiscount(rule, items, lines);
      if (discount) discounts.push(discount);
      continue;
    }

    if (rule.ruleType === 'MIX_AND_MATCH') {
      const filteredLines = lines.filter((line) => !fixedBundleProducts.has(line.productId));
      const discount = mixMatchDiscount(rule, items, filteredLines);
      if (discount) discounts.push(discount);
    }
  }

  discounts.push(...volumeDiscountsForLines(volumeRules, items, volumeLines));

  return { discounts };
}
