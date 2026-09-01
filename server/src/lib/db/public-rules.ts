import type { BundleRule } from '@pb/shared';
import type { EcwidStoreTokens } from '../ecwid.js';
import { readPublicConfig } from '../storage/ecwid-storage.js';
import { mapStoredRule, type StoredRuleRow } from './mappers.js';

export interface PublicAppConfig {
  cartUpsellEnabled?: boolean;
  rules?: StoredRuleRow[];
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

function normalizePublicRules(raw: unknown): StoredRuleRow[] {
  const decoded = decodeEcwidNestedJson(raw);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return [];
  const config = decoded as PublicAppConfig;
  if (!Array.isArray(config.rules)) return [];
  return config.rules as StoredRuleRow[];
}

export async function readPublicAppConfig(tokens: EcwidStoreTokens): Promise<PublicAppConfig> {
  const raw = await readPublicConfig(tokens);
  if (!raw || typeof raw !== 'object') return {};
  const decoded = decodeEcwidNestedJson(raw);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return {};
  return decoded as PublicAppConfig;
}

export function listActiveRulesFromEmbeddedPublicConfig(raw: unknown): BundleRule[] {
  return normalizePublicRules(raw)
    .filter((row) => row.status === 'ACTIVE')
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .map((row) => mapStoredRule(row));
}

export async function listActiveRulesFromPublicConfig(tokens: EcwidStoreTokens): Promise<BundleRule[]> {
  const config = await readPublicAppConfig(tokens);
  return normalizePublicRules(config)
    .filter((row) => row.status === 'ACTIVE')
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .map((row) => mapStoredRule(row));
}
