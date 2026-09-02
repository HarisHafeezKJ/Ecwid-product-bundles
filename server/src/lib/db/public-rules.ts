import { decodeEcwidNestedJson, toBundleRule, unwrapStorageDoc, type BundleRule } from '@pb/shared';
import type { EcwidStoreTokens } from '../ecwid.js';
import { readPublicConfig } from '../storage/ecwid-storage.js';

export { decodeEcwidNestedJson };

export interface PublicAppConfig {
  cartUpsellEnabled?: boolean;
  rules?: unknown[];
  rulesUpdatedAt?: string;
}

/**
 * Public config holds a mix of current BundleRule DTOs and legacy StoredRuleRow shapes.
 * Both go through the same parser so clamping and widget-style defaults match DB reads.
 */
function ruleFromPublicRow(row: unknown): BundleRule | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const candidate = row as Record<string, unknown>;
  const id = candidate.id ?? candidate._id;
  if (typeof id !== 'string' || !id) return null;

  const storeId = typeof candidate.storeId === 'string' ? candidate.storeId : '';
  return toBundleRule(candidate, storeId);
}

function normalizePublicRules(raw: unknown): BundleRule[] {
  const decoded = decodeEcwidNestedJson(raw);
  const unwrapped = unwrapStorageDoc<PublicAppConfig>(decoded) ?? decoded;
  if (!unwrapped || typeof unwrapped !== 'object' || Array.isArray(unwrapped)) return [];
  const config = unwrapped as PublicAppConfig;
  if (!Array.isArray(config.rules)) return [];
  return config.rules
    .map(ruleFromPublicRow)
    .filter((rule): rule is BundleRule => rule != null)
    .filter((rule) => rule.status === 'ACTIVE')
    .sort((a, b) => (b.createdAt?.toISOString?.() ?? '').localeCompare(a.createdAt?.toISOString?.() ?? ''));
}

export async function readPublicAppConfig(tokens: EcwidStoreTokens): Promise<PublicAppConfig> {
  const raw = await readPublicConfig(tokens);
  if (!raw || typeof raw !== 'object') return {};
  const decoded = decodeEcwidNestedJson(raw);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return {};
  return decoded as PublicAppConfig;
}

export function listActiveRulesFromEmbeddedPublicConfig(raw: unknown): BundleRule[] {
  return normalizePublicRules(raw);
}

export async function listActiveRulesFromPublicConfig(tokens: EcwidStoreTokens): Promise<BundleRule[]> {
  const config = await readPublicAppConfig(tokens);
  return normalizePublicRules(config);
}

export function serializeRulesForPublicConfig(rules: BundleRule[]): Record<string, unknown>[] {
  return rules.map((rule) => ({
    ...rule,
    createdAt: rule.createdAt instanceof Date ? rule.createdAt.toISOString() : rule.createdAt,
    updatedAt: rule.updatedAt instanceof Date ? rule.updatedAt.toISOString() : rule.updatedAt,
  }));
}
