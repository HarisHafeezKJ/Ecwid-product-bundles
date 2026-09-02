import {
  isPrivateStoreTokens,
  publicStoreTokens,
  type EcwidStoreTokens,
} from './ecwid.js';
import { getStoreTokens } from './auth.js';
import { getOAuthTokens } from './storage/oauth-cache.js';

export { isPrivateStoreTokens };

/** OAuth / public token resolution for storefront APIs (offer, add-discounted, etc.). */
export async function resolveStorefrontTokens(
  storeId: string,
  publicToken?: string,
): Promise<EcwidStoreTokens | null> {
  const cachedPrivate = await getOAuthTokens(storeId);

  if (cachedPrivate && isPrivateStoreTokens(cachedPrivate)) {
    if (publicToken && !cachedPrivate.publicToken) {
      return { ...cachedPrivate, publicToken };
    }
    return cachedPrivate;
  }

  if (publicToken) {
    return publicStoreTokens(storeId, publicToken);
  }

  const fromSession = await getStoreTokens(storeId);
  if (fromSession) return fromSession;

  return null;
}
