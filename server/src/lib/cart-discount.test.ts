import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BundleRule } from '@pb/shared';
import { calculateCartDiscounts } from './cart-discount.js';

function volumeRule(overrides: Partial<BundleRule> = {}): BundleRule {
  return {
    id: 'vol-1',
    title: 'Volume',
    ruleType: 'VOLUME_DISCOUNT',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    status: 'ACTIVE',
    applyToAllProducts: true,
    widgetStyle: {},
    items: { components: [] },
    volumeTiers: {
      tiers: [{ qty: 2, discountType: 'PERCENTAGE', discountValue: 10, title: '2+' }],
    },
    triggerProductIds: [],
    suggestedProductIds: [],
    allowVariantChoice: false,
    storeId: '1001',
    ...overrides,
  };
}

describe('calculateCartDiscounts', () => {
  it('returns empty discounts when cart is empty', () => {
    const result = calculateCartDiscounts([volumeRule()], []);
    assert.deepEqual(result.discounts, []);
  });

  it('applies volume discount when qty matches an exact tier', () => {
    const result = calculateCartDiscounts(
      [volumeRule()],
      [{ productId: 42, quantity: 2, productPrice: 20 }],
    );
    assert.ok(result.discounts.length > 0);
    assert.ok(result.discounts[0]!.value > 0);
  });
});
