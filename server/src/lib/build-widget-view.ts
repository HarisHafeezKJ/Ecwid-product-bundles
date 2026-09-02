import type { BundleItem, BundleRule, CatalogProduct, StorefrontWidgetView } from '@pb/shared';
import {
  bundleLineSale,
  exactVolumeUnitPrice,
  mixPoolProductIds,
  mixRequiredCount,
  ruleShowsOnProductPage,
  volumeUnitPrice,
  bestVolumeTier,
} from '@pb/shared';
import type { EcwidStoreTokens } from './ecwid.js';
import { getProducts } from './ecwid.js';

const STOCK_THRESHOLD = 1;

function variantUnitPrice(product: CatalogProduct, variantId?: string): number {
  if (variantId && product.variants?.length) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return variant.price;
  }
  return product.price;
}

function productInStock(product: CatalogProduct): boolean {
  if (!product.inStock) return false;
  if (product.variants?.length) {
    return product.variants.some((v) => v.inStock && (v.quantity ?? STOCK_THRESHOLD) >= STOCK_THRESHOLD);
  }
  return (product.quantity ?? STOCK_THRESHOLD) >= STOCK_THRESHOLD;
}

function totalsForBundle(rule: BundleRule, products: CatalogProduct[]): { original: number; discounted: number } {
  const items = rule.items?.components ?? [];
  let original = 0;
  let discounted = 0;
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;
    const qty = item.minQuantity ?? 1;
    const variantId = item.adminLocksVariant ? item.defaultVariantId : undefined;
    const unit = variantUnitPrice(product, variantId);
    original += unit * qty;
    discounted += bundleLineSale(unit, rule.discountType, rule.discountValue) * qty;
  }
  return { original, discounted };
}

function totalsForVolume(rule: BundleRule, products: CatalogProduct[]): { original: number; discounted: number } {
  const tiers = rule.volumeTiers?.tiers ?? [];
  const tier = tiers[0];
  if (!tier || !products[0]) return { original: 0, discounted: 0 };
  const unit = products[0].price;
  const qty = tier.qty;
  return {
    original: unit * qty,
    discounted: exactVolumeUnitPrice(unit, tier) * qty,
  };
}

function totalsForMix(rule: BundleRule, products: CatalogProduct[]): { original: number; discounted: number } {
  const tiers = rule.volumeTiers?.tiers ?? [];
  const required = mixRequiredCount(rule);
  const tier = bestVolumeTier(tiers, required) ?? tiers[0];
  if (!tier) return { original: 0, discounted: 0 };
  const slice = products.slice(0, required);
  let original = 0;
  let discounted = 0;
  for (const p of slice) {
    original += p.price;
    discounted += volumeUnitPrice(p.price, tier);
  }
  return { original, discounted };
}

function stubProductFromItem(item: BundleItem): CatalogProduct {
  return {
    id: item.productId,
    name: item.name ?? item.productId,
    sku: item.sku,
    price: item.price ?? 0,
    imageUrl: item.imageUrl,
    inStock: true,
  };
}

function mergeProductsWithRuleItems(
  loaded: CatalogProduct[],
  items: BundleItem[],
  productIds: string[],
): CatalogProduct[] {
  const byId = new Map(loaded.map((p) => [p.id, p]));
  const merged: CatalogProduct[] = [];
  for (const id of productIds) {
    const fromApi = byId.get(id);
    if (fromApi) {
      merged.push(fromApi);
      continue;
    }
    const item = items.find((row) => row.productId === id);
    if (item) merged.push(stubProductFromItem(item));
  }
  return merged;
}

/** Catalog IDs a rule needs to render on this product page. Empty = skip. */
export function catalogIdsForRule(rule: BundleRule, productId: string): string[] {
  if (!ruleShowsOnProductPage(rule, productId)) return [];

  const items = rule.items?.components ?? [];
  let productIds: string[] = [];

  switch (rule.ruleType) {
    case 'FIXED_BUNDLE':
      productIds = items.map((i) => i.productId);
      break;
    case 'VOLUME_DISCOUNT':
      productIds = rule.applyToAllProducts
        ? [productId]
        : mixPoolProductIds(rule).length > 0
          ? mixPoolProductIds(rule)
          : [productId];
      break;
    case 'MIX_AND_MATCH':
      productIds = mixPoolProductIds(rule);
      break;
    default:
      return [];
  }

  return [...new Set(productIds.filter(Boolean))];
}

export async function buildWidgetViewForRule(
  tokens: EcwidStoreTokens,
  rule: BundleRule,
  productId: string,
  overViewLimit = false,
  catalog?: CatalogProduct[],
): Promise<StorefrontWidgetView | null> {
  const productIds = catalogIdsForRule(rule, productId);
  if (productIds.length === 0) return null;

  const items = rule.items?.components ?? [];
  const loaded = (
    catalog
      ? catalog.filter((product) => productIds.includes(product.id))
      : await getProducts(tokens, productIds)
  ).filter(productInStock);
  const products = mergeProductsWithRuleItems(loaded, items, productIds).filter(productInStock);
  if (products.length === 0) return null;

  // Stubs are built from the rule's own copy of a component, so they hide the fact that
  // Ecwid never returned the product. A fixed bundle priced against a stub renders fine
  // and then fails at add-to-cart, so require every component to come from the catalog.
  if (rule.ruleType === 'FIXED_BUNDLE') {
    const requiredIds = items.map((item) => item.productId).filter(Boolean);
    const catalogIds = new Set(loaded.map((product) => product.id));
    if (!requiredIds.every((id) => catalogIds.has(id))) return null;
  }

  let totals = { original: 0, discounted: 0 };
  if (rule.ruleType === 'FIXED_BUNDLE') totals = totalsForBundle(rule, products);
  if (rule.ruleType === 'VOLUME_DISCOUNT') totals = totalsForVolume(rule, products);
  if (rule.ruleType === 'MIX_AND_MATCH') totals = totalsForMix(rule, products);

  return {
    rule,
    products,
    original: totals.original,
    discounted: totals.discounted,
    savings: Math.max(0, totals.original - totals.discounted),
    overViewLimit,
    mixRequiredCount: rule.ruleType === 'MIX_AND_MATCH' ? mixRequiredCount(rule) : undefined,
    mixPoolProductIds: rule.ruleType === 'MIX_AND_MATCH' ? mixPoolProductIds(rule) : undefined,
  };
}

export async function buildStorefrontWidgetViews(
  tokens: EcwidStoreTokens,
  rules: BundleRule[],
  productId: string,
  overViewLimit = false,
): Promise<StorefrontWidgetView[]> {
  const neededIds = [...new Set(rules.flatMap((rule) => catalogIdsForRule(rule, productId)))];
  const catalog = neededIds.length > 0 ? await getProducts(tokens, neededIds) : [];

  const built = await Promise.all(
    rules.map((rule) => buildWidgetViewForRule(tokens, rule, productId, overViewLimit, catalog)),
  );
  return built.filter((view): view is StorefrontWidgetView => view != null);
}
