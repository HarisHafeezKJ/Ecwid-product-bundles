import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bundleUsesPerUnitVariantPickers,
  bundleVariantFieldLabel,
  bundleVariantPickerCount,
} from './bundle-variant-ui.js';

const variants = [{ id: '1' }, { id: '2' }];

describe('bundleVariantPickerCount', () => {
  it('returns 0 when product has no options', () => {
    assert.equal(bundleVariantPickerCount({ minQuantity: 2, variants: [] }), 0);
    assert.equal(bundleVariantPickerCount({ minQuantity: 2, variants: [{ id: '1' }] }), 0);
  });

  it('returns qty when customer picks per unit', () => {
    assert.equal(
      bundleVariantPickerCount({
        minQuantity: 2,
        chooseVariationPerItem: true,
        variants,
      }),
      2,
    );
  });

  it('returns 1 for locked variant regardless of qty', () => {
    assert.equal(
      bundleVariantPickerCount({
        minQuantity: 3,
        adminLocksVariant: true,
        variants,
      }),
      1,
    );
  });

  it('returns 1 when qty is 1', () => {
    assert.equal(
      bundleVariantPickerCount({
        minQuantity: 1,
        chooseVariationPerItem: true,
        variants,
      }),
      1,
    );
  });
});

describe('bundleUsesPerUnitVariantPickers', () => {
  it('is true only for multi-qty customer choice', () => {
    assert.equal(
      bundleUsesPerUnitVariantPickers({
        minQuantity: 2,
        chooseVariationPerItem: true,
        variants,
      }),
      true,
    );
    assert.equal(
      bundleUsesPerUnitVariantPickers({
        minQuantity: 2,
        adminLocksVariant: true,
        variants,
      }),
      false,
    );
  });
});

describe('bundleVariantFieldLabel', () => {
  it('uses base label for a single picker', () => {
    assert.equal(bundleVariantFieldLabel('Size', 0, 1), 'Size');
  });

  it('numbers labels when multiple pickers', () => {
    assert.equal(bundleVariantFieldLabel('Size', 0, 2), 'Size 1');
    assert.equal(bundleVariantFieldLabel('Size', 1, 2), 'Size 2');
  });
});
