import type { BundleRule, CatalogProduct, StorefrontWidgetView, WidgetStyle } from '@pb/shared';
import type {
  SerializedStorefrontWidgetView,
  SerializedVolumeTierView,
  SerializedWidgetProductItem,
} from '@pb/shared';
import {
  bundleLineSale,
  exactVolumeUnitPrice,
  isTierDiscountable,
  normalizeWidgetStyleForStorefront,
  volumeUnitPrice,
} from '@pb/shared';

export { normalizeWidgetStyleForStorefront };

export type {
  SerializedStorefrontWidgetView,
  SerializedVolumeTierView,
  SerializedWidgetProductItem,
};

function variantUnitPrice(product: CatalogProduct, variantId?: string): number {
  if (variantId && product.variants?.length) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return variant.price;
  }
  return product.price;
}

export function mapVariants(product: CatalogProduct): SerializedWidgetProductItem['variants'] {
  return (product.variants ?? []).map((variant) => ({
    id: variant.id,
    label: Object.values(variant.options ?? {})
      .filter(Boolean)
      .join(' / ') || variant.sku || variant.id,
    inStock: variant.inStock,
    price: variant.price,
  }));
}

function mapBundleComponent(
  rule: BundleRule,
  item: NonNullable<BundleRule['items']>['components'][number],
  product: CatalogProduct | undefined,
): SerializedWidgetProductItem {
  const variantId = item.adminLocksVariant ? item.defaultVariantId : undefined;
  const unit = product ? variantUnitPrice(product, variantId) : (item.price ?? 0);
  const discounted = bundleLineSale(unit, rule.discountType, rule.discountValue);

  return {
    productId: item.productId,
    name: item.name ?? product?.name ?? item.productId,
    imageUrl: item.imageUrl ?? product?.imageUrl,
    minQuantity: item.minQuantity ?? 1,
    price: unit,
    discountedPrice: discounted,
    originalPrice: unit,
    sku: item.sku ?? product?.sku,
    isPrimary: item.isPrimary,
    inStock: product?.inStock,
    defaultVariantId: item.defaultVariantId,
    adminLocksVariant: item.adminLocksVariant,
    chooseVariationPerItem: item.chooseVariationPerItem,
    variants: product ? mapVariants(product) : undefined,
  };
}

function mapBundleItems(rule: BundleRule, products: CatalogProduct[]): SerializedWidgetProductItem[] {
  const components = rule.items?.components ?? [];
  return components.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    return mapBundleComponent(rule, item, product);
  });
}

function mapPoolItems(rule: BundleRule, products: CatalogProduct[]): SerializedWidgetProductItem[] {
  return products.map((product, index) =>
    mapBundleComponent(
      rule,
      {
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        price: product.price,
        sku: product.sku,
        minQuantity: 1,
        isPrimary: index === 0,
        chooseVariationPerItem: true,
        adminLocksVariant: false,
      },
      product,
    ),
  );
}

function mapVolumeTiers(rule: BundleRule, unitPrice: number): SerializedVolumeTierView[] {
  const tiers = rule.volumeTiers?.tiers ?? [];
  return tiers.map((tier) => {
    const discountedUnit = isTierDiscountable(tier) ? exactVolumeUnitPrice(unitPrice, tier) : unitPrice;
    return {
      qty: tier.qty,
      title: tier.title,
      discountType: tier.discountType,
      discountValue: tier.discountValue,
      imageUrl: tier.imageUrl,
      imageRadius: tier.imageRadius,
      imageSize: tier.imageSize,
      unitPrice: unitPrice,
      discountedUnitPrice: discountedUnit,
      savings: Math.max(0, unitPrice - discountedUnit),
    };
  });
}


export function serializeWidgetView(
  view: StorefrontWidgetView,
  currency = 'USD',
): SerializedStorefrontWidgetView {
  const { rule, products, original, discounted, savings, overViewLimit, mixRequiredCount } = view;
  const widgetStyle = normalizeWidgetStyleForStorefront(rule.widgetStyle ?? {});
  const targetProductId = rule.targetProductId ?? rule.primaryProductId;

  const base: SerializedStorefrontWidgetView = {
    ruleId: rule.id,
    ruleType: rule.ruleType,
    overViewLimit,
    status: rule.status,
    layout: rule.layout,
    allowVariantChoice: rule.allowVariantChoice,
    widgetStyle,
    currency,
    targetProductId,
    items: [],
  };

  switch (rule.ruleType) {
    case 'FIXED_BUNDLE':
      return {
        ...base,
        items: mapBundleItems(rule, products),
        discounted,
        original,
        savings,
      };

    case 'VOLUME_DISCOUNT': {
      const unit = products[0]?.price ?? 0;
      const volumeItem: SerializedWidgetProductItem = {
        productId: products[0]?.id ?? targetProductId ?? '',
        name: products[0]?.name ?? 'Product',
        imageUrl: products[0]?.imageUrl,
        minQuantity: 1,
        price: unit,
        inStock: products[0]?.inStock,
        variants: products[0] ? mapVariants(products[0]) : undefined,
      };
      return {
        ...base,
        items: products[0] ? [volumeItem] : [],
        volumeTiers: mapVolumeTiers(rule, unit),
        discounted,
        original,
        savings,
      };
    }

    case 'MIX_AND_MATCH': {
      const avgUnit =
        products.length > 0
          ? products.reduce((sum, product) => sum + product.price, 0) / products.length
          : 0;
      return {
        ...base,
        items: mapPoolItems(rule, products).map((item) => ({ ...item, minQuantity: 0 })),
        volumeTiers: mapVolumeTiers(rule, avgUnit),
        mixRequiredCount,
        mixDiscounted: discounted,
        mixOriginal: original,
        mixSavings: savings,
      };
    }

    default:
      return base;
  }
}
