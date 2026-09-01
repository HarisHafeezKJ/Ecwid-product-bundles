import type { StorefrontWidgetView, VolumeTierView, WidgetProductItem } from '../types';

type TierDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'SET_PRICE';

function clampDiscountValue(type: TierDiscountType, value: number): number {
  if (type === 'PERCENTAGE') return Math.min(100, Math.max(0, value));
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function volumeUnitPrice(basePrice: number, tier: VolumeTierView): number {
  const base = Number.isFinite(basePrice) ? basePrice : 0;
  const discountType = (tier.discountType ?? 'PERCENTAGE') as TierDiscountType;
  const discountValue = tier.discountValue ?? 0;
  const clamped = clampDiscountValue(discountType, discountValue);
  const tierQty = Math.max(1, tier.qty);

  switch (discountType) {
    case 'PERCENTAGE':
      return base * (1 - clamped / 100);
    case 'FIXED_AMOUNT': {
      const perUnitOff = clamped / tierQty;
      return Math.max(0, base - perUnitOff);
    }
    case 'SET_PRICE':
      return Math.min(base, clamped);
    default:
      return base;
  }
}

function isTierDiscountable(tier: VolumeTierView): boolean {
  if (tier.discountType === 'SET_PRICE') return true;
  return (tier.discountValue ?? 0) > 0;
}

function bestVolumeTier(tiers: VolumeTierView[], qty: number): VolumeTierView | undefined {
  const floorQty = Math.floor(qty);
  return tiers
    .filter((tier) => floorQty >= tier.qty && isTierDiscountable(tier))
    .sort((a, b) => b.qty - a.qty)[0];
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
  const tiers = view.volumeTiers ?? [];
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
