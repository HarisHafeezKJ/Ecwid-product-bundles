import { toBundleRule, type BundleRule } from '@pb/shared';
import type { EcwidStoreTokens } from '../ecwid.js';
import { readPublicConfig } from '../storage/ecwid-storage.js';

export interface PublicAppConfig {
  cartUpsellEnabled?: boolean;
  rules?: unknown[];
  rulesUpdatedAt?: string;
}

/** Decode Ecwid nested JSON envelopes (Instant Site `appsPublicConfigs`). */
export function decodeEcwidNestedJson(raw: unknown): unknown {
  let current = raw;
  for (let depth = 0; depth < 6; depth++) {
    if (typeof current === 'string') {
      const trimmed = current.trim();
      if (!trimmed) return null;
      try {
        current = JSON.parse(trimmed);
        continue;
      } catch {
        break;
      }
    }
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      const obj = current as Record<string, unknown>;
      if (obj.value != null) {
        const keys = Object.keys(obj);
        if (keys.length === 1 || (keys.length === 2 && keys.includes('key'))) {
          current = obj.value;
          continue;
        }
      }
    }
    break;
  }
  return current;
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
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return [];
  const config = decoded as PublicAppConfig;
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
