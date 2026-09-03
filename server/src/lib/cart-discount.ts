import type { BundleRule, CartQtyLine } from '@pb/shared';
import {
  bestVolumeTier,
  bundleLineSale,
  cartQtyForProduct,
  discountDisplayName,
  discountDisplayNameWithCount,
  exactVolumeTier,
  fixedBundleCompleteCount,
  fixedBundleDiscountQty,
  isRuleEligible,
  isTierDiscountable,
  mixMatchCartQty,
  mixPoolProductIds,
  parseBundleItems,
  readStampFromOptions,
  uniqueVolumeRuleForProduct,
  volumeUnitPrice,
  optionsFromSelectedOptions,
} from '@pb/shared';

export interface EcwidDiscountCartItem {
  productId: number;
  amount?: number;
  quantity?: number;
  productPrice?: number;
  priceInProductList?: number;
  price?: number;
  selectedOptions?: unknown;
  options?: Record<string, string>;
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

interface DiscountCartLine extends CartQtyLine {
  offerId?: string;
  dealId?: string;
  kind?: string;
  item: EcwidDiscountCartItem;
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function optionsFromDiscountItem(item: EcwidDiscountCartItem): Record<string, string> {
  if (item.options && Object.keys(item.options).length > 0) return item.options;
  return optionsFromSelectedOptions(item.selectedOptions);
}

function discountCartLines(items: EcwidDiscountCartItem[]): DiscountCartLine[] {
  return items
    .map((item) => {
      const options = optionsFromDiscountItem(item);
      const stamp = readStampFromOptions(options);
      return {
        productId: String(item.productId ?? ''),
        quantity: Math.max(0, Number(item.amount ?? item.quantity ?? 0)),
        offerId: stamp.offerId,
        dealId: stamp.dealId,
        kind: stamp.kind,
        item,
      };
    })
    .filter((line) => line.productId && line.quantity > 0);
}

function unitPriceFromItem(item: EcwidDiscountCartItem, catalogHint?: number): number {
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

function linesForBundleRule(lines: DiscountCartLine[], rule: BundleRule): DiscountCartLine[] {
  const stamped = lines.filter((line) => line.offerId === rule.id && line.kind === 'pb-combo');
  if (stamped.length > 0) return stamped;
  const byOffer = lines.filter((line) => line.offerId === rule.id);
  if (byOffer.length > 0) return byOffer;
  const unstamped = lines.filter((line) => !line.offerId);
  return unstamped.length > 0 ? unstamped : lines;
}

function linesForMixRule(lines: DiscountCartLine[], rule: BundleRule): DiscountCartLine[] {
  const stamped = lines.filter(
    (line) => line.offerId === rule.id && (line.kind === 'pb-mix' || line.kind === 'pb-volume'),
  );
  if (stamped.length > 0) return stamped;
  const byOffer = lines.filter((line) => line.offerId === rule.id);
  if (byOffer.length > 0) return byOffer;
  const unstamped = lines.filter((line) => !line.offerId);
  return unstamped.length > 0 ? unstamped : lines;
}

function fixedBundleDiscount(
  rule: BundleRule,
  items: EcwidDiscountCartItem[],
  lines: DiscountCartLine[],
): EcwidCartDiscount | null {
  const cartQtyLines = lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
  }));
  const bundleCount = fixedBundleCompleteCount(rule, cartQtyLines);
  if (bundleCount <= 0) return null;

  const components = parseBundleItems(rule.items).components;
  const productIds: number[] = [];
  let savings = 0;

  for (const component of components) {
    const qty = fixedBundleDiscountQty(component, bundleCount);
    if (qty <= 0) continue;
    const catalogHint = component.price != null && component.price > 0 ? component.price : undefined;
    const catalog = catalogUnitPrice(items, component.productId, catalogHint);
    if (catalog <= 0) continue;
    const sale = bundleLineSale(catalog, rule.discountType, rule.discountValue);
    const lineSavings = Math.max(0, catalog - sale) * qty;
    if (lineSavings <= 0) continue;

    savings += lineSavings;
    const productId = Number(component.productId);
    if (productId > 0) productIds.push(productId);
  }

  if (savings <= 0.001) return null;
  return {
    value: roundMoney(savings),
    type: 'ABSOLUTE',
    description: discountDisplayNameWithCount(rule, bundleCount),
    appliesToProducts: [...new Set(productIds)],
  };
}

function bundleAllocatedQtyByProduct(
  bundleRules: BundleRule[],
  lines: DiscountCartLine[],
): Map<string, number> {
  const allocated = new Map<string, number>();

  for (const rule of bundleRules) {
    const ruleLines = linesForBundleRule(lines, rule);
    if (!ruleLines.length) continue;
    const cartQtyLines = ruleLines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    }));
    const bundleCount = fixedBundleCompleteCount(rule, cartQtyLines);
    if (bundleCount <= 0) continue;

    for (const component of parseBundleItems(rule.items).components) {
      const qty = fixedBundleDiscountQty(component, bundleCount);
      allocated.set(
        component.productId,
        (allocated.get(component.productId) ?? 0) + qty,
      );
    }
  }

  return allocated;
}

function volumeDiscountForRule(
  rule: BundleRule,
  items: EcwidDiscountCartItem[],
  lines: DiscountCartLine[],
  bundleAllocated?: Map<string, number>,
): EcwidCartDiscount | null {
  const tiers = (rule.volumeTiers?.tiers ?? []).filter(isTierDiscountable);
  if (!tiers.length) return null;

  const pool = rule.applyToAllProducts
    ? null
    : new Set((rule.items?.components ?? []).map((c) => c.productId));

  const cartQtyLines = lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
  }));

  const tierByProduct = new Map<string, NonNullable<ReturnType<typeof exactVolumeTier>>>();
  for (const line of lines) {
    if (pool && !pool.has(line.productId) && line.productId !== rule.targetProductId) continue;
    if (tierByProduct.has(line.productId)) continue;
    const totalQty = cartQtyForProduct(cartQtyLines, line.productId);
    const allocated = bundleAllocated?.get(line.productId) ?? 0;
    const volumeQty = Math.max(0, totalQty - allocated);
    const tier = exactVolumeTier(tiers, volumeQty);
    if (tier) tierByProduct.set(line.productId, tier);
  }

  const productIds: number[] = [];
  let savings = 0;

  for (const [productId, tier] of tierByProduct) {
    const totalQty = cartQtyForProduct(cartQtyLines, productId);
    const allocated = bundleAllocated?.get(productId) ?? 0;
    const volumeQty = Math.max(0, totalQty - allocated);
    if (volumeQty <= 0) continue;

    const catalog = catalogUnitPrice(items, productId);
    if (catalog <= 0) continue;
    const sale = volumeUnitPrice(catalog, tier);
    const productSavings = Math.max(0, catalog - sale) * volumeQty;
    if (productSavings <= 0) continue;

    savings += productSavings;
    const pid = Number(productId);
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
  lines: DiscountCartLine[],
): EcwidCartDiscount | null {
  const cartQtyLines = lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
  }));
  if (!isRuleEligible(rule, cartQtyLines)) return null;

  const pool = mixPoolProductIds(rule);
  const tier = bestVolumeTier(rule.volumeTiers?.tiers ?? [], mixMatchCartQty(cartQtyLines, pool));
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

/** Assign unstamped products to at most one volume rule (ambiguous overlaps apply none). */
function volumeDiscountsForUnstampedLines(
  volumeRules: BundleRule[],
  bundleRules: BundleRule[],
  allLines: DiscountCartLine[],
  items: EcwidDiscountCartItem[],
  lines: DiscountCartLine[],
): EcwidCartDiscount[] {
  const discounts: EcwidCartDiscount[] = [];
  const linesByRule = new Map<string, DiscountCartLine[]>();
  const bundleAllocated = bundleAllocatedQtyByProduct(bundleRules, allLines);

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
    const discount = volumeDiscountForRule(
      rule,
      ruleLines.map((line) => line.item),
      ruleLines,
      bundleAllocated,
    );
    if (discount) discounts.push(discount);
  }

  return discounts;
}

/** Ecwid discountUrl handler — returns cart-level discounts for eligible bundle rules. */
export function calculateCartDiscounts(
  rules: BundleRule[],
  items: EcwidDiscountCartItem[],
): EcwidCartDiscountResponse {
  const lines = discountCartLines(items);
  if (!lines.length) return { discounts: [] };

  const active = rules.filter((r) => r.status === 'ACTIVE' && r.ruleType !== 'CART_UPSELL');
  const discounts: EcwidCartDiscount[] = [];

  for (const rule of active) {
    if (rule.ruleType !== 'FIXED_BUNDLE') continue;
    const ruleLines = linesForBundleRule(lines, rule);
    if (!ruleLines.length) continue;
    const discount = fixedBundleDiscount(
      rule,
      ruleLines.map((line) => line.item),
      ruleLines,
    );
    if (discount) discounts.push(discount);
  }

  for (const rule of active) {
    if (rule.ruleType !== 'MIX_AND_MATCH') continue;
    const ruleLines = linesForMixRule(lines, rule);
    if (!ruleLines.length) continue;
    const discount = mixMatchDiscount(
      rule,
      ruleLines.map((line) => line.item),
      ruleLines,
    );
    if (discount) discounts.push(discount);
  }

  const volumeRules = active.filter((r) => r.ruleType === 'VOLUME_DISCOUNT');
  const bundleRules = active.filter((r) => r.ruleType === 'FIXED_BUNDLE');
  const claimedByVolume = new Set<DiscountCartLine>();
  for (const rule of volumeRules) {
    let stampedLines = lines.filter((line) => line.offerId === rule.id && line.kind === 'pb-volume');
    if (!stampedLines.length) {
      stampedLines = lines.filter((line) => line.offerId === rule.id);
    }
    if (stampedLines.length > 0) {
      const discount = volumeDiscountForRule(
        rule,
        stampedLines.map((line) => line.item),
        stampedLines,
      );
      if (discount) {
        discounts.push(discount);
        for (const l of stampedLines) claimedByVolume.add(l);
      }
    }
  }

  const remainingVolumeLines = lines.filter((line) => !line.offerId || !claimedByVolume.has(line));
  discounts.push(
    ...volumeDiscountsForUnstampedLines(
      volumeRules,
      bundleRules,
      lines,
      remainingVolumeLines.map((line) => line.item),
      remainingVolumeLines,
    ),
  );

  return { discounts };
}
