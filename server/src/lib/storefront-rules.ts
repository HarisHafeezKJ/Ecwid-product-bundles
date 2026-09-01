import type { BundleRule, RuleType } from '@pb/shared';
import type { EcwidStoreTokens } from './ecwid.js';
import { listActiveRulesForStore } from './db/rules.js';
import {
  listActiveRulesFromEmbeddedPublicConfig,
  listActiveRulesFromPublicConfig,
} from './db/public-rules.js';
import { isProduction, loadEnvFiles } from './config.js';
import { ensureStoreTokens, getOAuthTokens } from './storage/oauth-cache.js';
import { fetchRulesFromStorefrontPage } from './storefront-public-config.js';

export type RuleResolutionSource = 'embedded' | 'db' | 'public-config' | 'html-scrape';

export interface ResolveRulesOptions {
  storeId: string;
  tokens?: EcwidStoreTokens;
  ruleType?: RuleType;
  ruleId?: string;
  merchantAppSettings?: unknown;
  excludeCartUpsell?: boolean;
}

export interface ResolveRulesResult {
  rules: BundleRule[];
  source?: RuleResolutionSource;
}

function filterRules(rules: BundleRule[], opts: ResolveRulesOptions): BundleRule[] {
  let filtered = rules;
  if (opts.ruleType) {
    filtered = filtered.filter((rule) => rule.ruleType === opts.ruleType);
  }
  if (opts.ruleId) {
    filtered = filtered.filter((rule) => rule.id === opts.ruleId);
  } else if (opts.excludeCartUpsell) {
    filtered = filtered.filter((rule) => rule.ruleType !== 'CART_UPSELL');
  }
  return filtered;
}

/**
 * Last-resort fallback for cold serverless instances with no cached OAuth token.
 * Opt-out only: disabling it by default in production would drop the sole remaining
 * rule source on a fresh Vercel lambda.
 */
export function htmlRuleScrapeAllowed(): boolean {
  loadEnvFiles();
  return process.env.PB_ALLOW_HTML_RULE_SCRAPE?.trim().toLowerCase() !== 'false';
}

/**
 * Single entry point for storefront/webhook rule resolution with explicit priority.
 *
 * A source only wins when it yields rules that survive the filter. A stale private
 * rules doc that still holds unrelated rules must not mask a rule that only exists
 * in public config, so an empty post-filter result falls through to the next source.
 */
export async function resolveRules(opts: ResolveRulesOptions): Promise<ResolveRulesResult> {
  const { storeId, tokens, merchantAppSettings } = opts;

  if (merchantAppSettings) {
    const fromSettings = filterRules(
      listActiveRulesFromEmbeddedPublicConfig(merchantAppSettings),
      opts,
    );
    if (fromSettings.length > 0) return { rules: fromSettings, source: 'embedded' };
  }

  const cachedPrivate = await getOAuthTokens(storeId);
  if (cachedPrivate?.accessToken) {
    try {
      const rules = filterRules(await listActiveRulesForStore(storeId, opts.ruleType), opts);
      if (rules.length > 0) return { rules, source: 'db' };
    } catch (err) {
      console.warn('[pb] resolveRules listActiveRulesForStore failed', err);
    }
  }

  const publicTokens = tokens ?? (await ensureStoreTokens(storeId));
  if (publicTokens?.accessToken) {
    try {
      const rules = filterRules(await listActiveRulesFromPublicConfig(publicTokens), opts);
      if (rules.length > 0) return { rules, source: 'public-config' };
    } catch (err) {
      console.warn('[pb] resolveRules listActiveRulesFromPublicConfig failed', err);
    }
  }

  if (htmlRuleScrapeAllowed()) {
    try {
      const rules = filterRules(await fetchRulesFromStorefrontPage(storeId), opts);
      if (rules.length > 0) return { rules, source: 'html-scrape' };
    } catch (err) {
      console.warn('[pb] resolveRules fetchRulesFromStorefrontPage failed', err);
    }
  }

  return { rules: [] };
}

/** Resolve a bundle rule on the storefront without requiring cached private OAuth. */
export async function resolveStorefrontBundleRule(
  storeId: string,
  ruleId: string,
  tokens: EcwidStoreTokens,
): Promise<BundleRule | null> {
  const { rules } = await resolveRules({ storeId, tokens, ruleId });
  return rules[0] ?? null;
}

/** Load active rules for Ecwid discount/cart-promotion webhooks (no session cookie). */
export async function resolveWebhookRules(
  storeId: string,
  merchantAppSettings?: unknown,
): Promise<BundleRule[]> {
  const { rules } = await resolveRules({ storeId, merchantAppSettings });
  return rules;
}
