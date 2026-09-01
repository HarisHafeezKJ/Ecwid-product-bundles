import type {
  AddDiscountedRequest,
  AddDiscountedResponse,
  CartUpsellResponse,
  OfferResponse,
  RuleType,
} from './types';
import { getPublicToken, getStoreId } from './ecwid';
import { apiBaseFromScript, findOwnScript } from './script-config';

let apiBaseUrl = '';

export function resolveApiBaseUrl(): string {
  if (apiBaseUrl) return apiBaseUrl;
  apiBaseUrl = apiBaseFromScript(findOwnScript());
  return apiBaseUrl;
}

export function setApiBaseUrl(url: string): void {
  apiBaseUrl = url.replace(/\/$/, '');
}

function storefrontUrl(path: string, query?: Record<string, string | undefined>): string {
  const base = resolveApiBaseUrl();
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  const storeId = getStoreId();
  if (storeId != null) url.searchParams.set('storeId', String(storeId));
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function parseJson<T>(res: Response): Promise<T | null> {
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchOffer(params: {
  productId: string;
  ruleType?: RuleType;
  ruleId?: string;
}): Promise<OfferResponse | null> {
  const publicToken = await getPublicToken();
  const url = storefrontUrl('/offer', {
    productId: params.productId,
    ruleType: params.ruleType,
    ruleId: params.ruleId,
    publicToken: publicToken ?? undefined,
  });
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return parseJson<OfferResponse>(res);
}

export async function addDiscounted(body: AddDiscountedRequest): Promise<AddDiscountedResponse> {
  const storeId = getStoreId();
  const publicToken = await getPublicToken();
  const res = await fetch(storefrontUrl('/add-discounted'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...body,
      storeId,
      publicToken: publicToken ?? undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    try {
      const data = JSON.parse(text) as { error?: string };
      throw new Error(data.error || text || `Request failed (${res.status})`);
    } catch {
      throw new Error(text || `Request failed (${res.status})`);
    }
  }
  const data = (await res.json()) as AddDiscountedResponse;
  if (!data?.ok) throw new Error('Could not add to cart.');
  return data;
}

export async function fetchCartUpsell(productIds: string[]): Promise<CartUpsellResponse | null> {
  if (!productIds.length) return null;
  const limited = productIds.slice(0, 50);
  const url = storefrontUrl('/cart-upsell', { productIds: limited.join(',') });
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return parseJson<CartUpsellResponse>(res);
}

export async function syncVolumeCart(cartId?: string): Promise<{ ok?: boolean; updated?: number }> {
  const storeId = getStoreId();
  const res = await fetch(storefrontUrl('/sync-volume-cart'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cartId, storeId }),
  });
  return (await parseJson<{ ok?: boolean; updated?: number }>(res)) ?? {};
}

export async function addCartUpsellLines(body: {
  ruleId: string;
  lines: { productId: string; quantity: number; variantId?: string }[];
}): Promise<{ ok?: boolean }> {
  const storeId = getStoreId();
  const res = await fetch(storefrontUrl('/cart-upsell'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, storeId }),
  });
  return (await parseJson<{ ok?: boolean }>(res)) ?? {};
}
