import type { BundleRule } from './types.js';

const TYPE_DEFAULT_LABELS: Record<Exclude<BundleRule['ruleType'], 'CART_UPSELL'>, string> = {
  VOLUME_DISCOUNT: 'SAVE & SMILE',
  FIXED_BUNDLE: 'Bundle Deal',
  MIX_AND_MATCH: 'Mix & Match',
};

export function discountDisplayName(rule: Pick<BundleRule, 'ruleType' | 'widgetStyle'>): string {
  if (rule.ruleType === 'CART_UPSELL') return '';

  const checkout = rule.widgetStyle?.checkoutLabel?.trim();
  if (checkout) return checkout;

  const promo = rule.widgetStyle?.promoLabel?.trim();
  if (promo) return promo;

  return TYPE_DEFAULT_LABELS[rule.ruleType] ?? 'Promotion';
}
