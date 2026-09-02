import { getStoreProfile, isPrivateStoreTokens, type EcwidStoreTokens } from './ecwid.js';
import { persistStoreCurrency } from './db/settings.js';

const CURRENCY_TTL_MS = 10 * 60 * 1000;

interface Entry {
  currency: string;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

function remember(storeId: string, currency: string, ttlMs = CURRENCY_TTL_MS): string {
  cache.set(storeId, { currency, expiresAt: Date.now() + ttlMs });
  return currency;
}

function fallback(tokens: EcwidStoreTokens, persistedHint?: string): string {
  const hint = persistedHint?.trim();
  if (hint) return remember(tokens.storeId, hint);
  return cache.get(tokens.storeId)?.currency ?? 'USD';
}

/**
 * Storefront routes only need the store's currency (for formatting money on the
 * client). Fetching `/profile` on every offer/upsell response added a full Ecwid
 * round-trip per widget render, and would silently 403 when only a public token
 * was available.
 *
 * Resolution order: in-memory (10 min) → `/profile` when a private token is
 * present → persisted `pb_settings.currency` hint → USD.
 */
export async function getStoreCurrency(
  tokens: EcwidStoreTokens,
  persistedHint?: string,
): Promise<string> {
  const cached = cache.get(tokens.storeId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.currency;

  if (!isPrivateStoreTokens(tokens)) {
    return fallback(tokens, persistedHint);
  }

  try {
    const profile = await getStoreProfile(tokens);
    const raw = profile.formatsAndUnits as { currency?: string } | undefined;
    const currency = raw?.currency ? String(raw.currency) : fallback(tokens, persistedHint);
    remember(tokens.storeId, currency);
    void persistStoreCurrency(tokens.storeId, currency).catch((err) => {
      console.warn('[pb] persistStoreCurrency failed', err);
    });
    return currency;
  } catch (err) {
    console.warn('[pb] getStoreCurrency failed', err);
    const currency = fallback(tokens, persistedHint);
    return remember(tokens.storeId, currency, 60_000);
  }
}

/** Test / installation helper — clear cached currency for a store. */
export function invalidateStoreCurrency(storeId: string): void {
  cache.delete(storeId);
}
