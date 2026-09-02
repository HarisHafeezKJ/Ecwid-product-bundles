import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listActiveRulesFromEmbeddedPublicConfig } from './public-rules.js';

describe('listActiveRulesFromEmbeddedPublicConfig', () => {
  it('unwraps v2 storage envelope before reading rules', () => {
    const rules = listActiveRulesFromEmbeddedPublicConfig({
      v: 2,
      data: {
        rules: [
          {
            id: 'bundle-1',
            title: 'Bundle',
            ruleType: 'FIXED_BUNDLE',
            discountType: 'PERCENTAGE',
            discountValue: 10,
            status: 'ACTIVE',
            applyToAllProducts: false,
            widgetStyle: {},
            items: {
              components: [
                { productId: '101', minQuantity: 2 },
                { productId: '102', minQuantity: 2 },
              ],
            },
            volumeTiers: { tiers: [] },
            triggerProductIds: [],
            suggestedProductIds: [],
            allowVariantChoice: true,
            storeId: '1001',
          },
        ],
      },
    });

    assert.equal(rules.length, 1);
    assert.equal(rules[0]!.ruleType, 'FIXED_BUNDLE');
    assert.equal(rules[0]!.items.components.length, 2);
  });
});
