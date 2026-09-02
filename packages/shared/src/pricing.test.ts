import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bundleLineSale, clampDiscountValue, volumeUnitPrice } from './pricing.js';
import { bestVolumeTier } from './volume-tiers.js';

describe('clampDiscountValue', () => {
  it('caps percentage at 100', () => {
    assert.equal(clampDiscountValue('PERCENTAGE', 150), 100);
  });

  it('returns 0 for NONE', () => {
    assert.equal(clampDiscountValue('NONE', 50), 0);
  });
});

describe('bundleLineSale', () => {
  it('applies percentage discount', () => {
    assert.equal(bundleLineSale(100, 'PERCENTAGE', 10), 90);
  });

  it('applies fixed amount discount', () => {
    assert.equal(bundleLineSale(100, 'FIXED_AMOUNT', 15), 85);
  });
});

describe('volumeUnitPrice', () => {
  it('spreads fixed amount across tier qty', () => {
    const price = volumeUnitPrice(20, {
      qty: 2,
      discountType: 'FIXED_AMOUNT',
      discountValue: 4,
    });
    assert.equal(price, 18);
  });
});

describe('bestVolumeTier', () => {
  const tiers = [
    { qty: 2, discountType: 'PERCENTAGE' as const, discountValue: 5 },
    { qty: 4, discountType: 'PERCENTAGE' as const, discountValue: 10 },
  ];

  it('picks highest qualifying tier', () => {
    assert.equal(bestVolumeTier(tiers, 4)?.qty, 4);
  });

  it('returns undefined when no tier qualifies', () => {
    assert.equal(bestVolumeTier(tiers, 1), undefined);
  });
});
