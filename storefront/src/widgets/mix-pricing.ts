import { bestVolumeTier, volumeUnitPrice, type VolumeTier } from '@pb/shared';
import type { StorefrontWidgetView, WidgetProductItem } from '../types';

function asVolumeTiers(tiers: StorefrontWidgetView['volumeTiers']): VolumeTier[] {
  return (tiers ?? []).map((tier) => ({
    qty: tier.qty,
    discountType: (tier.discountType ?? 'PERCENTAGE') as VolumeTier['discountType'],
    discountValue: tier.discountValue ?? 0,
    title: tier.title,
    imageUrl: tier.imageUrl,
    imageRadius: tier.imageRadius,
    imageSize: tier.imageSize,
  }));
}

function itemUnitPrice(item: WidgetProductItem, variantId?: string): number {
  if (variantId && item.variants?.length) {
    const variant = item.variants.find((row) => row.id === variantId);
    if (variant?.price != null) return variant.price;
  }
  return item.price;
}

export function computeMixTotals(
  view: StorefrontWidgetView,
  mixQtys: Record<string, number>,
  variantSelections: Record<string, string>,
): { original: number; discounted: number } {
  const tiers = asVolumeTiers(view.volumeTiers);
  let original = 0;
  let selectedQty = 0;

  for (const item of view.items) {
    const qty = mixQtys[item.productId] ?? 0;
    if (qty <= 0) continue;
    const unit = itemUnitPrice(item, variantSelections[item.productId]);
    original += unit * qty;
    selectedQty += qty;
  }

  if (selectedQty === 0) return { original: 0, discounted: 0 };

  const tier = bestVolumeTier(tiers, selectedQty);
  if (!tier) return { original, discounted: original };

  let discounted = 0;
  for (const item of view.items) {
    const qty = mixQtys[item.productId] ?? 0;
    if (qty <= 0) continue;
    const unit = itemUnitPrice(item, variantSelections[item.productId]);
    discounted += volumeUnitPrice(unit, tier) * qty;
  }

  return { original, discounted };
}
