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

  it('applies volume discount when tier qty is split across cart lines', () => {
    const rule = volumeRule({
      volumeTiers: {
        tiers: [{ qty: 5, discountType: 'PERCENTAGE', discountValue: 10, title: '5+' }],
      },
    });
    const result = calculateCartDiscounts(
      [rule],
      Array.from({ length: 5 }, () => ({ productId: 42, quantity: 1, productPrice: 20 })),
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

  it('appends apply count to the discount description for multiple complete bundles', () => {
    const rule = fixedBundleRule(
      [
        { productId: '101', minQuantity: 2, price: 50 },
        { productId: '102', minQuantity: 2, price: 20 },
        { productId: '103', minQuantity: 2, price: 40 },
      ],
      10,
    );
    rule.title = 'Lazy bundle 1';

    const result = calculateCartDiscounts([rule], [
      { productId: 101, quantity: 6, productPrice: 50 },
      { productId: 102, quantity: 6, productPrice: 20 },
      { productId: 103, quantity: 6, productPrice: 40 },
    ]);

    assert.equal(result.discounts.length, 1);
    assert.equal(result.discounts[0]?.description, 'Lazy bundle 1 ( x3 )');
    assert.ok((result.discounts[0]?.value ?? 0) > 0);
  });

  it('applies bundle and volume discounts on the same product when deal stamps differ', () => {
    const bundle = fixedBundleRule([
      { productId: '42', minQuantity: 2, price: 50 },
      { productId: '99', minQuantity: 2, price: 20 },
    ]);
    bundle.title = 'Lazy bundle 1';

    const volume = volumeRule({
      id: 'vol-hoodie',
      title: 'Lazy quantity discount deal 1',
      applyToAllProducts: false,
      items: { components: [{ productId: '42', minQuantity: 1, isPrimary: true }] },
      volumeTiers: {
        tiers: [{ qty: 5, discountType: 'PERCENTAGE', discountValue: 10, title: '5+' }],
      },
    });

    const dealStamp = (offerId: string, dealId: string, kind: string) => ({
      selectedOptions: [{ name: '_pbDeal', value: [offerId, dealId, kind].join('\x1f') }],
    });

    const result = calculateCartDiscounts(
      [bundle, volume],
      [
        {
          productId: 42,
          quantity: 2,
          productPrice: 50,
          ...dealStamp(bundle.id, `${bundle.id}:bundle`, 'pb-combo'),
        },
        {
          productId: 99,
          quantity: 2,
          productPrice: 20,
          ...dealStamp(bundle.id, `${bundle.id}:bundle`, 'pb-combo'),
        },
        {
          productId: 42,
          quantity: 5,
          productPrice: 50,
          ...dealStamp(volume.id, `${volume.id}:vol-5`, 'pb-volume'),
        },
      ],
    );

    assert.equal(result.discounts.length, 2);
    assert.ok(result.discounts.some((row) => row.description.includes('Lazy bundle 1')));
    assert.ok(result.discounts.some((row) => row.description.includes('Lazy quantity discount deal 1')));
  });

  it('applies volume on remaining qty after bundle allocation on a merged cart line', () => {
    const bundle = fixedBundleRule([
      { productId: '101', minQuantity: 2, price: 50 },
      { productId: '102', minQuantity: 2, price: 20 },
      { productId: '42', minQuantity: 2, price: 50 },
    ]);
    bundle.title = 'Lazy bundle 1';

    const volume = volumeRule({
      id: 'vol-hoodie',
      title: 'Lazy quantity discount deal 1',
      applyToAllProducts: false,
      items: { components: [{ productId: '42', minQuantity: 1, isPrimary: true }] },
      volumeTiers: {
        tiers: [{ qty: 5, discountType: 'PERCENTAGE', discountValue: 10, title: '5+' }],
      },
    });

    const result = calculateCartDiscounts([bundle, volume], [
      { productId: 101, quantity: 2, productPrice: 50 },
      { productId: 102, quantity: 2, productPrice: 20 },
      { productId: 42, quantity: 7, productPrice: 50 },
    ]);

    assert.equal(result.discounts.length, 2);
    assert.ok(result.discounts.some((row) => row.description.includes('Lazy bundle 1')));
    assert.ok(result.discounts.some((row) => row.description.includes('Lazy quantity discount deal 1')));
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
