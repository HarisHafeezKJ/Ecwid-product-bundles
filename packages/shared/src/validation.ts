import { clampDiscountValue } from './pricing.js';
import { mixRequiredCount, validateTierSequence } from './volume-tiers.js';
import type { BundleItem, RuleFormInput, ValidationResult } from './types.js';

function hasTitle(value: RuleFormInput): boolean {
  return Boolean(value.title?.trim());
}

function bundleItems(value: RuleFormInput): BundleItem[] {
  return value.items?.components ?? [];
}

function validateDiscount(
  discountType: RuleFormInput['discountType'],
  discountValue: number | undefined,
): string[] {
  const errors: string[] = [];
  if (!discountType || discountType === 'NONE') return errors;

  const value = discountValue ?? 0;
  if (value < 0) {
    errors.push('Enter a valid discount value.');
    return errors;
  }

  if (discountType === 'PERCENTAGE') {
    if (value > 100) {
      errors.push('Discount must be between 0 and 100.');
    }
  } else if (value <= 0 && discountType !== 'SET_PRICE') {
    errors.push('Enter a discount value.');
  }

  return errors;
}

function validateLockedVariants(items: BundleItem[]): string[] {
  const errors: string[] = [];
  for (const item of items) {
    if (item.adminLocksVariant && !item.defaultVariantId) {
      errors.push('Select a default variation for locked items.');
      break;
    }
  }
  return errors;
}

export function validateRuleForm(input: RuleFormInput): ValidationResult {
  const errors: string[] = [];

  if (!hasTitle(input)) {
    errors.push('Enter a title.');
  }

  switch (input.ruleType) {
    case 'FIXED_BUNDLE': {
      const items = bundleItems(input);
      if (items.length < 2) {
        errors.push('Select at least two products.');
      }
      if (!input.applyToAllProducts && !input.targetProductId) {
        errors.push('Select a primary product.');
      }
      errors.push(...validateDiscount(input.discountType, input.discountValue));
      errors.push(...validateLockedVariants(items));
      break;
    }

    case 'VOLUME_DISCOUNT': {
      const tiers = input.volumeTiers?.tiers ?? [];
      errors.push(...validateTierSequence(tiers, { exactQty: true, minTiers: 2, maxTiers: 50 }));

      if (!input.applyToAllProducts) {
        const items = bundleItems(input);
        if (items.length < 1) {
          errors.push('Select at least one product.');
        } else if (items.length > 25) {
          errors.push('Select up to 25 products.');
        }
      }
      break;
    }

    case 'MIX_AND_MATCH': {
      const items = bundleItems(input);
      const hasCollection = Boolean(input.sourceCollectionId);
      if (!hasCollection && items.length < 2) {
        errors.push('Select at least two products.');
      } else if (!hasCollection && items.length > 25) {
        errors.push('Select between 2 and 25 products.');
      }

      const tiers = input.volumeTiers?.tiers ?? [];
      errors.push(...validateTierSequence(tiers, { exactQty: false, minTiers: 1, maxTiers: 5 }));

      if (tiers.length === 0) {
        errors.push('Add at least one tier.');
      }

      const required = mixRequiredCount(input);
      if (required < 1) {
        errors.push('Enter a valid minimum item count.');
      }

      if (!input.applyToAllProducts && !input.targetProductId && items.length === 0 && !hasCollection) {
        errors.push('Select a target product or enable all product pages.');
      }

      errors.push(...validateLockedVariants(items));
      break;
    }

    case 'CART_UPSELL': {
      const triggers = input.triggerProductIds ?? [];
      const suggested = input.suggestedProductIds ?? [];
      if (triggers.length < 1) {
        errors.push('Add at least one trigger product.');
      }
      if (suggested.length < 1) {
        errors.push('Add at least one suggested product.');
      }
      break;
    }

    default:
      errors.push('Select a valid offer type.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function clampRuleDiscountInput(input: RuleFormInput): RuleFormInput {
  const discountType = input.discountType ?? 'NONE';
  return {
    ...input,
    discountType,
    discountValue: clampDiscountValue(discountType, input.discountValue ?? 0),
  };
}
