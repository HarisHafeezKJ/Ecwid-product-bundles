import type { BundleRule, CatalogProduct, PricedLine } from '@pb/shared';
import {
  bundleLineSale,
  discountDisplayName,
  exactVolumeTier,
  exactVolumeUnitPrice,
  isTierDiscountable,
  mixPoolProductIds,
  parseBundleItems,
  stampOptions,
  volumeUnitPrice,
  bestVolumeTier,
} from '@pb/shared';
import type { EcwidStoreTokens } from './ecwid.js';
import { getProduct } from './ecwid.js';

export interface PriceLineInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

async function unitPriceForProduct(
  tokens: EcwidStoreTokens,
  productId: string,
  variantId?: string,
): Promise<{ product: CatalogProduct; unitPrice: number }> {
  const product = await getProduct(tokens, productId);
  if (!product || !product.inStock) throw new Error('Product is not available');

  if (variantId && product.variants?.length) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant || !variant.inStock) throw new Error('Product is not available');
    return { product, unitPrice: variant.price };
  }

  return { product, unitPrice: product.price };
}

function dealIdFor(rule: BundleRule, suffix: string): string {
  return `${rule.id}:${suffix}`;
}

export async function priceLinesForRule(
  tokens: EcwidStoreTokens,
  rule: BundleRule,
  lines: PriceLineInput[],
): Promise<PricedLine[]> {
  if (rule.status !== 'ACTIVE') throw new Error('Bundle is not available');
  const promoLabel = discountDisplayName(rule);

  switch (rule.ruleType) {
    case 'FIXED_BUNDLE':
      return priceFixedBundle(tokens, rule, lines, promoLabel);
    case 'VOLUME_DISCOUNT':
      return priceVolumeDiscount(tokens, rule, lines, promoLabel);
    case 'MIX_AND_MATCH':
      return priceMixMatch(tokens, rule, lines, promoLabel);
    default:
      throw new Error('Bundle is not available');
  }
}

async function priceFixedBundle(
  tokens: EcwidStoreTokens,
  rule: BundleRule,
  lines: PriceLineInput[],
  promoLabel: string,
): Promise<PricedLine[]> {
  const items = parseBundleItems(rule.items).components;
  if (items.length < 2) throw new Error('Bundle is incomplete');

  const bundleProductIds = new Set(items.map((i) => i.productId));
  for (const line of lines) {
    if (!bundleProductIds.has(line.productId)) throw new Error('Bundle is not available');
  }

  const priced: PricedLine[] = [];
  for (const line of lines) {
    const item = items.find((i) => i.productId === line.productId);
    const qty = Math.max(1, line.quantity);
    const minQty = item?.minQuantity ?? 1;
    if (qty < minQty) throw new Error('Bundle is not available');

    const variantId =
      line.variantId ?? (item?.adminLocksVariant ? item.defaultVariantId : undefined);

    const { unitPrice: catalogPrice } = await unitPriceForProduct(
      tokens,
      line.productId,
      variantId,
    );
    const sale = bundleLineSale(catalogPrice, rule.discountType, rule.discountValue);

    priced.push({
      productId: line.productId,
      variantId,
      quantity: qty,
      unitPrice: sale,
      catalogPrice,
      offerId: rule.id,
      dealId: dealIdFor(rule, 'bundle'),
      promoLabel,
      options: stampOptions(rule.id, dealIdFor(rule, 'bundle'), 'pb-combo'),
    });
  }

  return priced;
}

async function priceVolumeDiscount(
  tokens: EcwidStoreTokens,
  rule: BundleRule,
  lines: PriceLineInput[],
  promoLabel: string,
): Promise<PricedLine[]> {
  const tiers = (rule.volumeTiers?.tiers ?? []).filter(isTierDiscountable);
  if (tiers.length === 0) throw new Error('Quantity break is not available');

  const pool = rule.applyToAllProducts ? null : new Set(mixPoolProductIds(rule));
  const priced: PricedLine[] = [];

  for (const line of lines) {
    if (pool && !pool.has(line.productId) && line.productId !== rule.targetProductId) {
      throw new Error('Product is not in this quantity break');
    }

    const tier = exactVolumeTier(tiers, line.quantity);
    if (!tier) throw new Error('Quantity break is not available');

    const { unitPrice: catalogPrice } = await unitPriceForProduct(
      tokens,
      line.productId,
      line.variantId,
    );
    const sale = exactVolumeUnitPrice(catalogPrice, tier);

    priced.push({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: sale,
      catalogPrice,
      offerId: rule.id,
      dealId: dealIdFor(rule, `vol-${tier.qty}`),
      promoLabel,
      options: stampOptions(rule.id, dealIdFor(rule, `vol-${tier.qty}`), 'pb-volume'),
    });
  }

  return priced;
}

async function priceMixMatch(
  tokens: EcwidStoreTokens,
  rule: BundleRule,
  lines: PriceLineInput[],
  promoLabel: string,
): Promise<PricedLine[]> {
  const pool = new Set(mixPoolProductIds(rule));
  if (pool.size === 0) throw new Error('Bundle is incomplete');

  const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
  const tiers = rule.volumeTiers?.tiers ?? [];
  const tier = bestVolumeTier(tiers, totalQty);
  if (!tier) throw new Error('Bundle is not available');

  const priced: PricedLine[] = [];
  for (const line of lines) {
    if (!pool.has(line.productId)) throw new Error('Bundle is not available');
    const { unitPrice: catalogPrice } = await unitPriceForProduct(
      tokens,
      line.productId,
      line.variantId,
    );
    const sale = volumeUnitPrice(catalogPrice, tier);
    priced.push({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: sale,
      catalogPrice,
      offerId: rule.id,
      dealId: dealIdFor(rule, `mix-${tier.qty}`),
      promoLabel,
      options: stampOptions(rule.id, dealIdFor(rule, `mix-${tier.qty}`), 'pb-volume'),
    });
  }

  return priced;
}
