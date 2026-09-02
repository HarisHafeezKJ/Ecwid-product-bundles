import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BundleRule } from './types.js';
import { fixedBundleCompleteCount, isRuleEligible } from './bundle-eligibility.js';

function fixedBundleRule(
  components: Array<{ productId: string; minQuantity?: number }>,
): BundleRule {
  return {
    id: 'bundle-1',
    title: 'Bundle',
    ruleType: 'FIXED_BUNDLE',
    discountType: 'PERCENTAGE',
    discountValue: 10,
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

describe('fixedBundleCompleteCount', () => {
  it('returns 1 when each component meets its min quantity exactly', () => {
    const rule = fixedBundleRule([
      { productId: '1', minQuantity: 2 },
      { productId: '2', minQuantity: 2 },
      { productId: '3', minQuantity: 2 },
    ]);
    const count = fixedBundleCompleteCount(rule, [
      { productId: '1', quantity: 2 },
      { productId: '2', quantity: 2 },
      { productId: '3', quantity: 2 },
    ]);
    assert.equal(count, 1);
  });

  it('returns 0 when any component is below min quantity', () => {
    const rule = fixedBundleRule([
      { productId: '1', minQuantity: 2 },
      { productId: '2', minQuantity: 2 },
      { productId: '3', minQuantity: 2 },
    ]);
    const count = fixedBundleCompleteCount(rule, [
      { productId: '1', quantity: 1 },
      { productId: '2', quantity: 2 },
      { productId: '3', quantity: 2 },
    ]);
    assert.equal(count, 0);
    assert.equal(isRuleEligible(rule, [
      { productId: '1', quantity: 1 },
      { productId: '2', quantity: 2 },
      { productId: '3', quantity: 2 },
    ]), false);
  });

  it('caps complete bundles when some components exceed min quantity', () => {
    const rule = fixedBundleRule([
      { productId: '1', minQuantity: 2 },
      { productId: '2', minQuantity: 2 },
      { productId: '3', minQuantity: 2 },
    ]);
    const count = fixedBundleCompleteCount(rule, [
      { productId: '1', quantity: 3 },
      { productId: '2', quantity: 14 },
      { productId: '3', quantity: 2 },
    ]);
    assert.equal(count, 1);
  });

  it('counts multiple complete bundles', () => {
    const rule = fixedBundleRule([
      { productId: '1', minQuantity: 2 },
      { productId: '2', minQuantity: 2 },
    ]);
    const count = fixedBundleCompleteCount(rule, [
      { productId: '1', quantity: 4 },
      { productId: '2', quantity: 4 },
    ]);
    assert.equal(count, 2);
  });
});
