import type { BundleRule, RuleType } from '@pb/shared';
import { emptyRuleInput } from '@pb/shared';

export type OfferDraft = Omit<BundleRule, 'id' | 'storeId' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  activateOnSave?: boolean;
};

export function blankDraft(ruleType: RuleType): OfferDraft {
  const base = emptyRuleInput(ruleType, '');
  return {
    ...base,
    title: base.title ?? '',
    ruleType: base.ruleType ?? ruleType,
    discountType: base.discountType ?? 'NONE',
    discountValue: base.discountValue ?? 0,
    status: base.status ?? 'ACTIVE',
    applyToAllProducts: base.applyToAllProducts ?? true,
    widgetStyle: base.widgetStyle ?? {},
    items: base.items ?? { components: [] },
    volumeTiers: base.volumeTiers ?? { tiers: [] },
    triggerProductIds: base.triggerProductIds ?? [],
    suggestedProductIds: base.suggestedProductIds ?? [],
    allowVariantChoice: base.allowVariantChoice ?? true,
    activateOnSave: true,
  };
}

export function draftFromRule(rule: BundleRule): OfferDraft {
  return {
    id: rule.id,
    title: rule.title,
    ruleType: rule.ruleType,
    discountType: rule.discountType,
    discountValue: rule.discountValue,
    status: rule.status,
    primaryProductId: rule.primaryProductId,
    displayOn: rule.displayOn,
    applyToAllProducts: rule.applyToAllProducts,
    targetProductId: rule.targetProductId,
    layout: rule.layout,
    widgetStyle: { ...rule.widgetStyle },
    items: {
      components: rule.items.components.map((c) => ({ ...c })),
    },
    sourceCollectionId: rule.sourceCollectionId,
    requiredCount: rule.requiredCount,
    volumeTiers: {
      tiers: rule.volumeTiers.tiers.map((t) => ({ ...t })),
    },
    triggerProductIds: [...rule.triggerProductIds],
    suggestedProductIds: [...rule.suggestedProductIds],
    allowVariantChoice: rule.allowVariantChoice,
    activateOnSave: rule.status === 'ACTIVE',
  };
}

export function draftToRuleInput(draft: OfferDraft): Record<string, unknown> {
  const status = draft.activateOnSave === false ? 'DISABLED' : draft.status ?? 'ACTIVE';
  const displayOn = draft.applyToAllProducts ? 'ALL_ITEMS' : 'PRIMARY';
  const primaryProductId =
    draft.primaryProductId ?? draft.items.components[0]?.productId ?? draft.targetProductId;

  return {
    id: draft.id,
    title: draft.title.trim(),
    ruleType: draft.ruleType,
    discountType: draft.discountType,
    discountValue: draft.discountValue,
    status,
    primaryProductId,
    displayOn,
    applyToAllProducts: draft.applyToAllProducts,
    targetProductId: draft.targetProductId ?? primaryProductId,
    layout: draft.layout ?? 'VERTICAL',
    widgetStyle: {
      ...draft.widgetStyle,
      checkoutLabel: draft.widgetStyle.checkoutLabel ?? draft.widgetStyle.promoLabel,
      promoLabel: draft.widgetStyle.promoLabel ?? draft.widgetStyle.checkoutLabel,
    },
    items: draft.items,
    sourceCollectionId: draft.sourceCollectionId,
    requiredCount:
      draft.ruleType === 'MIX_AND_MATCH'
        ? (draft.volumeTiers.tiers[0]?.qty ?? draft.requiredCount ?? 2)
        : draft.requiredCount,
    volumeTiers: draft.volumeTiers,
    triggerProductIds: draft.triggerProductIds,
    suggestedProductIds: draft.suggestedProductIds,
    allowVariantChoice: draft.allowVariantChoice,
  };
}
