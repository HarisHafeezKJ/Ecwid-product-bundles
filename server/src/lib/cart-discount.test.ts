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

function fixedBundleRule(
  components: Array<{ productId: string; minQuantity?: number; price?: number }>,
  discountValue = 10,
): BundleRule {
  return {
    id: 'bundle-1',
    title: 'Bundle Deal',
    ruleType: 'FIXED_BUNDLE',
    discountType: 'PERCENTAGE',
    discountValue,
    status: 'ACTIVE',
    applyToAllProducts: false,
    widgetStyle: {},
    items: { components },
    volumeTiers: { tiers: [] },
    triggerProductIds: [],
    suggestedProductIds: [],
    allowVariantChoice: false,
    storeId: '1001',
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

  it('discounts only bundle-defined quantities when cart has excess units', () => {
    const rule = fixedBundleRule([
      { productId: '101', minQuantity: 2, price: 50 },
      { productId: '102', minQuantity: 2, price: 20 },
      { productId: '103', minQuantity: 2, price: 40 },
    ]);

    const exactResult = calculateCartDiscounts([rule], [
      { productId: 101, quantity: 2, productPrice: 50 },
      { productId: 102, quantity: 2, productPrice: 20 },
      { productId: 103, quantity: 2, productPrice: 40 },
    ]);

    const excessResult = calculateCartDiscounts([rule], [
      { productId: 101, quantity: 3, productPrice: 50 },
      { productId: 102, quantity: 14, productPrice: 20 },
      { productId: 103, quantity: 2, productPrice: 40 },
    ]);

    assert.ok(exactResult.discounts.length === 1);
    assert.ok(excessResult.discounts.length === 1);
    assert.equal(
      excessResult.discounts[0]!.value,
      exactResult.discounts[0]!.value,
      'excess units should not increase bundle savings',
    );
    assert.equal(exactResult.discounts[0]!.description, 'Bundle Deal');
  });

  it('uses cartDiscountLabel for the checkout discount description', () => {
    const rule = fixedBundleRule(
      [
        { productId: '101', minQuantity: 2, price: 50 },
        { productId: '102', minQuantity: 2, price: 20 },
      ],
      10,
    );
    rule.title = 'My Bundle Offer';
    rule.widgetStyle = { ...rule.widgetStyle, cartDiscountLabel: 'Combo savings' };

    const result = calculateCartDiscounts([rule], [
      { productId: 101, quantity: 2, productPrice: 50 },
      { productId: 102, quantity: 2, productPrice: 20 },
    ]);

    assert.equal(result.discounts[0]?.description, 'Combo savings');
  });

  it('falls back to rule title for the checkout discount description', () => {
    const rule = fixedBundleRule(
      [
        { productId: '101', minQuantity: 2, price: 50 },
        { productId: '102', minQuantity: 2, price: 20 },
      ],
      10,
    );
    rule.title = 'My Bundle Offer';
    rule.widgetStyle = { ...rule.widgetStyle, cartDiscountLabel: '' };

    const result = calculateCartDiscounts([rule], [
      { productId: 101, quantity: 2, productPrice: 50 },
      { productId: 102, quantity: 2, productPrice: 20 },
    ]);

    assert.equal(result.discounts[0]?.description, 'My Bundle Offer');
  });

  it('returns no fixed bundle discount when a component is below min quantity', () => {
    const rule = fixedBundleRule([
      { productId: '101', minQuantity: 2, price: 50 },
      { productId: '102', minQuantity: 2, price: 20 },
      { productId: '103', minQuantity: 2, price: 40 },
    ]);

    const result = calculateCartDiscounts([rule], [
      { productId: 101, quantity: 1, productPrice: 50 },
      { productId: 102, quantity: 2, productPrice: 20 },
      { productId: 103, quantity: 2, productPrice: 40 },
    ]);

    assert.deepEqual(result.discounts, []);
  });
});
