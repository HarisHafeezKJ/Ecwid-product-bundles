import { asBoolean, asNumber, asString, asStringArray, isDiscountType, isRuleType } from './guards.js';
import { parseBundleItems } from './bundle-items.js';
import { clampDiscountValue } from './pricing.js';
import { inferApplyToAllProducts } from './rule-placement.js';
import { DEFAULT_SETTINGS } from './settings.js';
import { defaultVolumeTiersForRuleType, parseVolumeTiers } from './volume-tiers.js';
import { defaultWidgetStyle, parseWidgetStyle } from './widget-style.js';
import { DEFAULT_TITLES } from './rule-labels.js';
import type {
  AppSettings,
  BundleRule,
  DisplayOn,
  OfferLayout,
  PlanTier,
  RuleStatus,
  RuleType,
  VolumeTiersWrap,
} from './types.js';

export { DEFAULT_SETTINGS };

function parseVolumeTiersWrap(raw: unknown): VolumeTiersWrap {
  return { tiers: parseVolumeTiers(raw) };
}

function parseDisplayOn(value: unknown): DisplayOn | undefined {
  return value === 'PRIMARY' || value === 'ALL_ITEMS' ? value : undefined;
}

function parseLayout(value: unknown): OfferLayout | undefined {
  return value === 'VERTICAL' || value === 'HORIZONTAL' ? value : undefined;
}

function parseStatus(value: unknown): RuleStatus {
  if (value === 'ACTIVE' || value === 'DRAFT' || value === 'DISABLED') return value;
  return 'ACTIVE';
}

function parsePlanTier(value: unknown): PlanTier {
  if (value === 'FREE' || value === 'STARTER' || value === 'GROWTH' || value === 'PRO') {
    return value;
  }
  return 'FREE';
}

function inferApplyToAllFromRow(row: Record<string, unknown>): boolean {
  return inferApplyToAllProducts({
    applyToAllProducts:
      row.applyToAllProducts != null ? asBoolean(row.applyToAllProducts, true) : undefined,
    displayOn: parseDisplayOn(row.displayOn),
    primaryProductId: asString(row.primaryProductId) || undefined,
  });
}

export function emptyRuleInput(ruleType: RuleType, storeId: string): Partial<BundleRule> {
  const applyToAllProducts = ruleType === 'VOLUME_DISCOUNT';
  return {
    title: DEFAULT_TITLES[ruleType],
    ruleType,
    status: 'ACTIVE',
    discountType: 'NONE',
    discountValue: 0,
    applyToAllProducts,
    displayOn: applyToAllProducts ? 'ALL_ITEMS' : 'PRIMARY',
    layout: 'VERTICAL',
    widgetStyle: defaultWidgetStyle(ruleType),
    items: { components: [] },
    volumeTiers: {
      tiers:
        ruleType === 'VOLUME_DISCOUNT' || ruleType === 'MIX_AND_MATCH'
          ? defaultVolumeTiersForRuleType(ruleType)
          : [],
    },
    triggerProductIds: [],
    suggestedProductIds: [],
    allowVariantChoice: ruleType !== 'CART_UPSELL',
    requiredCount:
      ruleType === 'MIX_AND_MATCH'
        ? defaultVolumeTiersForRuleType('MIX_AND_MATCH')[0]?.qty ?? 2
        : undefined,
    storeId,
  };
}

export function toBundleRule(raw: Record<string, unknown>, storeId: string): BundleRule {
  const ruleType = isRuleType(raw.ruleType) ? raw.ruleType : 'FIXED_BUNDLE';
  const discountType = isDiscountType(raw.discountType) ? raw.discountType : 'NONE';
  const discountValue = clampDiscountValue(discountType, asNumber(raw.discountValue, 0));
  const items = parseBundleItems(raw.items);
  const volumeTiers = parseVolumeTiersWrap(raw.volumeTiers);
  const widgetStyle = parseWidgetStyle(raw.widgetStyle, ruleType);
  const applyToAllProducts = inferApplyToAllFromRow(raw);

  return {
    id: asString(raw.id ?? raw._id),
    title: asString(raw.title, DEFAULT_TITLES[ruleType]),
    ruleType,
    discountType,
    discountValue,
    status: parseStatus(raw.status),
    primaryProductId: asString(raw.primaryProductId) || undefined,
    displayOn: parseDisplayOn(raw.displayOn),
    applyToAllProducts,
    targetProductId: asString(raw.targetProductId) || undefined,
    layout: parseLayout(raw.layout),
    widgetStyle,
    items,
    sourceCollectionId: asString(raw.sourceCollectionId) || undefined,
    requiredCount: asNumber(raw.requiredCount, 0) || undefined,
    volumeTiers,
    triggerProductIds: asStringArray(raw.triggerProductIds),
    suggestedProductIds: asStringArray(raw.suggestedProductIds),
    allowVariantChoice: asBoolean(raw.allowVariantChoice, ruleType !== 'CART_UPSELL'),
    storeId: asString(raw.storeId, storeId),
    createdAt: raw.createdAt ? new Date(asString(raw.createdAt)) : undefined,
    updatedAt: raw.updatedAt ? new Date(asString(raw.updatedAt)) : undefined,
  };
}

export function toAppSettings(raw: Record<string, unknown>, storeId: string): AppSettings {
  return {
    id: asString(raw.id ?? raw._id) || undefined,
    storeId: asString(raw.storeId, storeId),
    title: asString(raw.title, DEFAULT_SETTINGS.title),
    widgetTitle: asString(raw.widgetTitle, DEFAULT_SETTINGS.widgetTitle),
    buttonLabel: asString(raw.buttonLabel, DEFAULT_SETTINGS.buttonLabel),
    showSavingsBadge: asBoolean(raw.showSavingsBadge, DEFAULT_SETTINGS.showSavingsBadge ?? true),
    themeSyncEnabled: asBoolean(raw.themeSyncEnabled, DEFAULT_SETTINGS.themeSyncEnabled ?? true),
    stockShieldEnabled: asBoolean(raw.stockShieldEnabled, DEFAULT_SETTINGS.stockShieldEnabled ?? true),
    stockThreshold: asNumber(raw.stockThreshold, DEFAULT_SETTINGS.stockThreshold ?? 1),
    planTier: parsePlanTier(raw.planTier),
    monthlyViewsLimit: asNumber(raw.monthlyViewsLimit, DEFAULT_SETTINGS.monthlyViewsLimit),
    currentViewsCount: asNumber(raw.currentViewsCount, 0),
    viewsPeriod: asString(raw.viewsPeriod, ''),
    cartUpsellEnabled: asBoolean(raw.cartUpsellEnabled, false),
    currency: asString(raw.currency) || undefined,
  };
}

export function bundleRuleToInput(rule: BundleRule): Partial<BundleRule> {
  return {
    ...rule,
    widgetStyle: parseWidgetStyle(rule.widgetStyle, rule.ruleType),
    discountValue: clampDiscountValue(rule.discountType, rule.discountValue),
  };
}
