import type { BundleRule } from '@pb/shared';
import type { EcwidStoreTokens } from './ecwid.js';
import { getBundleRule, listActiveRulesForStore } from './db/rules.js';
import {
  listActiveRulesFromEmbeddedPublicConfig,
  listActiveRulesFromPublicConfig,
} from './db/public-rules.js';
import { ensureStoreTokens, getOAuthTokens } from './storage/oauth-cache.js';
import { fetchRulesFromStorefrontPage } from './storefront-public-config.js';

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

/** Load active rules for Ecwid discount/cart-promotion webhooks (no session cookie). */
export async function resolveWebhookRules(
  storeId: string,
  merchantAppSettings?: unknown,
): Promise<BundleRule[]> {
  if (merchantAppSettings) {
    const fromSettings = listActiveRulesFromEmbeddedPublicConfig(merchantAppSettings);
    if (fromSettings.length > 0) return fromSettings;
  }

  const cachedPrivate = await getOAuthTokens(storeId);
  if (cachedPrivate?.accessToken) {
    try {
      const rules = await listActiveRulesForStore(storeId);
      if (rules.length > 0) return rules;
    } catch (err) {
      console.warn('[pb] resolveWebhookRules listActiveRulesForStore failed', err);
    }
  }

  const tokens = await ensureStoreTokens(storeId);
  if (tokens?.accessToken) {
    try {
      const rules = await listActiveRulesFromPublicConfig(tokens);
      if (rules.length > 0) return rules;
    } catch (err) {
      console.warn('[pb] resolveWebhookRules listActiveRulesFromPublicConfig failed', err);
    }
  }

  try {
    const rules = await fetchRulesFromStorefrontPage(storeId);
    if (rules.length > 0) return rules;
  } catch (err) {
    console.warn('[pb] resolveWebhookRules storefront public config failed', err);
  }

  return [];
}
