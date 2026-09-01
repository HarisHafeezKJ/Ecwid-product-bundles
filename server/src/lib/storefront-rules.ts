import type { BundleRule } from '@pb/shared';
import type { EcwidStoreTokens } from './ecwid.js';
import { getBundleRule } from './db/rules.js';
import {
  listActiveRulesFromEmbeddedPublicConfig,
  listActiveRulesFromPublicConfig,
} from './db/public-rules.js';
import { getOAuthTokens } from './storage/oauth-cache.js';

/** Resolve a bundle rule on the storefront without requiring cached private OAuth. */
export async function resolveStorefrontBundleRule(
  storeId: string,
  ruleId: string,
  tokens: EcwidStoreTokens,
  embeddedPublicConfig?: unknown,
): Promise<BundleRule | null> {
  const cachedPrivate = await getOAuthTokens(storeId);
  if (cachedPrivate?.accessToken) {
    try {
      const rule = await getBundleRule(storeId, ruleId);
      if (rule) return rule;
    } catch (err) {
      console.warn('[pb] getBundleRule failed, falling back to public config', err);
    }
  }

  let rules: BundleRule[] = [];
  try {
    rules = await listActiveRulesFromPublicConfig(tokens);
  } catch (err) {
    console.warn('[pb] listActiveRulesFromPublicConfig failed', err);
  }

  if (rules.length === 0 && embeddedPublicConfig) {
    rules = listActiveRulesFromEmbeddedPublicConfig(embeddedPublicConfig);
  }

  return rules.find((r) => r.id === ruleId) ?? null;
}
