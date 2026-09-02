import type { BundleRule } from './types.js';

const TYPE_DEFAULT_LABELS: Record<Exclude<BundleRule['ruleType'], 'CART_UPSELL'>, string> = {
  VOLUME_DISCOUNT: 'SAVE & SMILE',
  FIXED_BUNDLE: 'Bundle Deal',
  MIX_AND_MATCH: 'Mix & Match',
};

export function discountDisplayName(
  rule: Pick<BundleRule, 'ruleType' | 'title' | 'widgetStyle'>,
): string {
  if (rule.ruleType === 'CART_UPSELL') return '';

  const cartLabel = rule.widgetStyle?.cartDiscountLabel?.trim();
  if (cartLabel) return cartLabel;

  const title = rule.title?.trim();
  if (title) return title;

  return TYPE_DEFAULT_LABELS[rule.ruleType] ?? 'Promotion';
}
