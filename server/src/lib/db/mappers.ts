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
  return toBundleRule(row as unknown as Record<string, unknown>, row.storeId);
}

export function ruleInputFromBody(body: Record<string, unknown>, storeId: string): Partial<BundleRule> {
  return toBundleRule({ ...body, storeId }, storeId);
}
