import type { BundleRule } from '@pb/shared';
import { getEcwidClientId } from './config.js';
import { decodeEcwidNestedJson, listActiveRulesFromEmbeddedPublicConfig } from './db/public-rules.js';

function parseInitialState(html: string): Record<string, unknown> | null {
  const match = html.match(/initialState\s*=\s*("(?:\\.|[^"\\])*")/);
  if (!match) return null;
  try {
    const once = JSON.parse(match[1]!) as string;
    const state = JSON.parse(once) as Record<string, unknown>;
    return state;
  } catch {
    return null;
  }
}

function storefrontUrls(storeId: string): string[] {
  return [
    `https://store${storeId}.company.site/`,
    `https://${storeId}.company.site/`,
  ];
}

/** Fallback for discount webhooks when OAuth tokens are unavailable on a cold serverless instance. */
export async function fetchRulesFromStorefrontPage(storeId: string): Promise<BundleRule[]> {
  const clientId = getEcwidClientId();

  for (const url of storefrontUrls(storeId)) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'text/html' },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;

      const html = await res.text();
      const state = parseInitialState(html);
      const context = state?.context as Record<string, unknown> | undefined;
      const configs = context?.appsPublicConfigs as Record<string, unknown> | undefined;
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
      const state = parseInitialState(html);
      const context = state?.context as Record<string, unknown> | undefined;
      const configs = context?.appsPublicConfigs as Record<string, unknown> | undefined;
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
