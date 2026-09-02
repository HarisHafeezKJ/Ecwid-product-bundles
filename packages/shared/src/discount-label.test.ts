import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { discountDisplayName } from './discount-label.js';

describe('discountDisplayName', () => {
  it('uses cartDiscountLabel when configured', () => {
    const label = discountDisplayName({
      ruleType: 'FIXED_BUNDLE',
      title: 'Summer Bundle',
      widgetStyle: { cartDiscountLabel: 'Combo savings' },
    });
    assert.equal(label, 'Combo savings');
  });

  it('falls back to the rule title when cartDiscountLabel is blank', () => {
    const label = discountDisplayName({
      ruleType: 'FIXED_BUNDLE',
      title: 'Summer Bundle',
      widgetStyle: {},
    });
    assert.equal(label, 'Summer Bundle');
  });

  it('uses the rule-type default only when title is also blank', () => {
    const label = discountDisplayName({
      ruleType: 'FIXED_BUNDLE',
      title: '',
      widgetStyle: {},
    });
    assert.equal(label, 'Bundle Deal');
  });
});
