import type { BundleRule } from '@pb/shared';
import { toBundleRule } from '@pb/shared';

export interface StoredRuleRow {
  id: string;
  title: string;
  ruleType: string;
  discountType: string;
  discountValue: number;
  status: string;
  primaryProductId?: string | null;
  displayOn?: string | null;
  applyToAllProducts: boolean;
  targetProductId?: string | null;
  layout?: string | null;
  widgetStyle: unknown;
  items: unknown;
  sourceCollectionId?: string | null;
  requiredCount?: number | null;
  volumeTiers: unknown;
  triggerProductIds: unknown;
  suggestedProductIds: unknown;
  allowVariantChoice: boolean;
  storeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredRulesDoc {
  rules: StoredRuleRow[];
}

export function mapStoredRule(row: StoredRuleRow): BundleRule {
  return toBundleRule(
    {
      id: row.id,
      title: row.title,
      ruleType: row.ruleType,
      discountType: row.discountType,
      discountValue: row.discountValue,
      status: row.status,
      primaryProductId: row.primaryProductId,
      displayOn: row.displayOn,
      applyToAllProducts: row.applyToAllProducts,
      targetProductId: row.targetProductId,
      layout: row.layout,
      widgetStyle: row.widgetStyle,
      items: row.items,
      sourceCollectionId: row.sourceCollectionId,
      requiredCount: row.requiredCount,
      volumeTiers: row.volumeTiers,
      triggerProductIds: row.triggerProductIds,
      suggestedProductIds: row.suggestedProductIds,
      allowVariantChoice: row.allowVariantChoice,
      storeId: row.storeId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    row.storeId,
  );
}

export function ruleInputFromBody(body: Record<string, unknown>, storeId: string): Partial<BundleRule> {
  return toBundleRule({ ...body, storeId }, storeId);
}
