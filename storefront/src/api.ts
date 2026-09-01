import type {
  AddDiscountedRequest,
  AddDiscountedResponse,
  CartLineSnapshotPayload,
  CartUpsellResponse,
  OfferResponse,
  RuleType,
} from './types';
import { getEmbeddedPublicConfig, getPublicToken, getStoreId } from './ecwid';
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

function parseApiError(text: string, status: number): string {
  const trimmed = text.trim();
  if (!trimmed) return `Request failed (${status})`;
  try {
    const data = JSON.parse(trimmed) as { error?: string; message?: string };
    return data.error || data.message || trimmed;
  } catch {
    return trimmed;
  }
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
  const storeId = getStoreId();
  const publicToken = await getPublicToken();
  const publicConfig = getEmbeddedPublicConfig();
  const res = await fetch(storefrontUrl('/offer'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId: params.productId,
      ruleType: params.ruleType,
      ruleId: params.ruleId,
      storeId,
      publicToken: publicToken ?? undefined,
      publicConfig: publicConfig ?? undefined,
    }),
  });
  return parseJson<OfferResponse>(res);
}

export async function addDiscounted(body: AddDiscountedRequest): Promise<AddDiscountedResponse> {
  const storeId = getStoreId();
  const publicToken = await getPublicToken();
  const publicConfig = getEmbeddedPublicConfig();
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
      publicConfig: publicConfig ?? undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(parseApiError(text, res.status));
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

export async function syncVolumeCart(
  cartId?: string,
  lines?: CartLineSnapshotPayload[],
): Promise<{ ok?: boolean; updated?: number }> {
  if (!lines?.length) return { ok: true, updated: 0 };

  const storeId = getStoreId();
  const publicToken = await getPublicToken();
  const res = await fetch(storefrontUrl('/sync-volume-cart'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cartId,
      storeId,
      lines,
      publicToken: publicToken ?? undefined,
    }),
  });
  if (!res.ok) return { ok: false, updated: 0 };
  return (await res.json()) as { ok?: boolean; updated?: number };
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
