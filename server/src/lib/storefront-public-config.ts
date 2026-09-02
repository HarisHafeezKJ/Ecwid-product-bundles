import type { BundleRule } from '@pb/shared';
import { decodeEcwidNestedJson, parseInstantSiteContextFromHtml } from '@pb/shared';
import { getEcwidClientId } from './config.js';
import { listActiveRulesFromEmbeddedPublicConfig } from './db/public-rules.js';

const SCRAPE_CACHE_TTL_MS = 30 * 60 * 1000;

interface ScrapeCacheEntry {
  rules: BundleRule[];
  expiresAt: number;
}

const scrapeCache = new Map<string, ScrapeCacheEntry>();

function storefrontUrls(storeId: string): string[] {
  return [
    `https://store${storeId}.company.site/`,
    `https://${storeId}.company.site/`,
  ];
}

async function scrapeRulesFromStorefront(storeId: string): Promise<BundleRule[]> {
  const clientId = getEcwidClientId();

  for (const url of storefrontUrls(storeId)) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'text/html' },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;

      const html = await res.text();
      const context = parseInstantSiteContextFromHtml(html);
      const configs = context?.appsPublicConfigs;
      const raw = configs?.[clientId];
      if (!raw) continue;

      const decoded = decodeEcwidNestedJson(raw);
      const rules = listActiveRulesFromEmbeddedPublicConfig(decoded);
      if (rules.length > 0) return rules;
    } catch {
      /* try next URL */
    }
  }

  return [];
}

/** Fallback for discount webhooks when OAuth tokens are unavailable on a cold serverless instance. */
export async function fetchRulesFromStorefrontPage(storeId: string): Promise<BundleRule[]> {
  const cached = scrapeCache.get(storeId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.rules;

  const rules = await scrapeRulesFromStorefront(storeId);
  scrapeCache.set(storeId, { rules, expiresAt: now + SCRAPE_CACHE_TTL_MS });
  return rules;
}

/** Test helper — clear cached scrape results for a store. */
export function invalidateStorefrontScrapeCache(storeId?: string): void {
  if (storeId) scrapeCache.delete(storeId);
  else scrapeCache.clear();
}

export async function fetchEmbeddedPublicConfigFromStore(
  storeId: string,
): Promise<Record<string, unknown> | null> {
  const clientId = getEcwidClientId();

  for (const url of storefrontUrls(storeId)) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'text/html' },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;

      const html = await res.text();
      const context = parseInstantSiteContextFromHtml(html);
      const configs = context?.appsPublicConfigs;
      const raw = configs?.[clientId];
      if (!raw) continue;

      const decoded = decodeEcwidNestedJson(raw);
      if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
        return decoded as Record<string, unknown>;
      }
    } catch {
      /* try next URL */
    }
  }

  return null;
}
