import type { EcwidStoreTokens } from './ecwid.js';
import { getStoreTokens } from './auth.js';
import { getOAuthTokens } from './storage/oauth-cache.js';

/** OAuth / public token resolution for storefront APIs (offer, add-discounted, etc.). */
export async function resolveStorefrontTokens(
  storeId: string,
  publicToken?: string,
): Promise<EcwidStoreTokens | null> {
  const cachedPrivate = await getOAuthTokens(storeId);

  let tokens = cachedPrivate;
  if (tokens && publicToken && !tokens.publicToken) {
    tokens = { ...tokens, publicToken };
  }
  if (!tokens && publicToken) {
    tokens = { storeId, accessToken: publicToken, publicToken };
  }
  if (!tokens) {
    tokens = await getStoreTokens(storeId);
  }
  return tokens;
}
