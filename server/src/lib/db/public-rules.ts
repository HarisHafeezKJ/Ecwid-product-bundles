import type { BundleRule } from '@pb/shared';
import type { EcwidStoreTokens } from '../ecwid.js';
import { readPublicConfig } from '../storage/ecwid-storage.js';
import { mapStoredRule, type StoredRuleRow } from './mappers.js';

export interface PublicAppConfig {
  cartUpsellEnabled?: boolean;
  rules?: StoredRuleRow[];
  rulesUpdatedAt?: string;
}

function normalizePublicRules(raw: unknown): StoredRuleRow[] {
  if (!raw || typeof raw !== 'object') return [];
  const config = raw as PublicAppConfig;
  if (!Array.isArray(config.rules)) return [];
  return config.rules as StoredRuleRow[];
}

export async function readPublicAppConfig(tokens: EcwidStoreTokens): Promise<PublicAppConfig> {
  const raw = await readPublicConfig(tokens);
  if (!raw || typeof raw !== 'object') return {};
  return raw as PublicAppConfig;
}

export async function listActiveRulesFromPublicConfig(tokens: EcwidStoreTokens): Promise<BundleRule[]> {
  const config = await readPublicAppConfig(tokens);
  return normalizePublicRules(config)
    .filter((row) => row.status === 'ACTIVE')
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .map((row) => mapStoredRule(row));
}
