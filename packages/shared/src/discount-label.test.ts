import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { discountDisplayName, discountDisplayNameWithCount } from './discount-label.js';

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

describe('discountDisplayNameWithCount', () => {
  it('appends a multiplier when the deal applies more than once', () => {
    const label = discountDisplayNameWithCount(
      {
        ruleType: 'FIXED_BUNDLE',
        title: 'Lazy bundle 1',
        widgetStyle: {},
      },
      3,
    );
    assert.equal(label, 'Lazy bundle 1 ( x3 )');
  });

  it('leaves the label unchanged when the deal applies once', () => {
    const label = discountDisplayNameWithCount(
      {
        ruleType: 'FIXED_BUNDLE',
        title: 'Lazy bundle 1',
        widgetStyle: {},
      },
      1,
    );
    assert.equal(label, 'Lazy bundle 1');
  });
});
