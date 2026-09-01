import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BundleRule, CatalogProduct, StorefrontWidgetView } from '@pb/shared';
import {
  serializeWidgetView,
  type SerializedStorefrontWidgetView,
} from './serialize-widget-view.js';

function volumeRule(): BundleRule {
  return {
    id: 'rule-volume-1',
    title: 'Volume offer',
    ruleType: 'VOLUME_DISCOUNT',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    status: 'ACTIVE',
    applyToAllProducts: true,
    widgetStyle: { blockTitle: 'Buy more, save more' },
    items: { components: [] },
    volumeTiers: {
      tiers: [{ qty: 2, discountType: 'PERCENTAGE', discountValue: 10, title: '2 items' }],
    },
    triggerProductIds: [],
    suggestedProductIds: [],
    allowVariantChoice: false,
    storeId: '1001',
  };
}

function volumeView(): StorefrontWidgetView {
  const product: CatalogProduct = {
    id: '42',
    name: 'Sample product',
    price: 20,
    inStock: true,
  };
  return {
    rule: volumeRule(),
    products: [product],
    original: 40,
    discounted: 36,
    savings: 4,
    overViewLimit: false,
  };
}

describe('serializeWidgetView', () => {
  it('returns a storefront-safe widget contract', () => {
    const serialized: SerializedStorefrontWidgetView = serializeWidgetView(volumeView(), 'EUR');

    assert.equal(serialized.ruleId, 'rule-volume-1');
    assert.equal(serialized.ruleType, 'VOLUME_DISCOUNT');
    assert.equal(serialized.currency, 'EUR');
    assert.equal(serialized.items.length, 1);
    assert.equal(serialized.items[0]?.productId, '42');
    assert.ok(serialized.volumeTiers?.length);
    assert.equal(serialized.volumeTiers?.[0]?.qty, 2);
  });

  it('maps admin widget style aliases for the storefront', () => {
    const view = volumeView();
    view.rule.widgetStyle = {
      ...view.rule.widgetStyle,
      offerCardSelectedBg: '#eef2ff',
      buyAllColor: '#111827',
      productDivider: 'PLUS',
      qtyPromptText: 'Pick {{COUNT}} more',
    };

    const serialized = serializeWidgetView(view, 'USD');
    assert.equal(serialized.widgetStyle.offerSelectedBg, '#eef2ff');
    assert.equal(serialized.widgetStyle.buyAllAtColor, '#111827');
    assert.equal(serialized.widgetStyle.divider, 'PLUS');
    assert.equal(serialized.widgetStyle.mixCtaSelectMore, 'Pick {{COUNT}} more');
  });
});
