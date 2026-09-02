import type { CatalogProduct, CatalogVariant } from '@pb/shared';
import { PB_DEAL_TEXT_OPTION } from '@pb/shared';

const ECWID_API_BASE = 'https://app.ecwid.com/api/v3';

export type EcwidTokenKind = 'private' | 'public';

export interface EcwidStoreTokens {
  storeId: string;
  accessToken: string;
  publicToken?: string;
  /** Whether `accessToken` is the merchant OAuth token or a storefront public token. */
  tokenKind: EcwidTokenKind;
}

export function isPrivateStoreTokens(tokens: EcwidStoreTokens): boolean {
  return tokens.tokenKind === 'private';
}

export function privateStoreTokens(
  storeId: string,
  accessToken: string,
  publicToken?: string,
): EcwidStoreTokens {
  return { storeId, accessToken, publicToken, tokenKind: 'private' };
}

export function publicStoreTokens(storeId: string, publicToken: string): EcwidStoreTokens {
  return { storeId, accessToken: publicToken, publicToken, tokenKind: 'public' };
}

export interface EcwidCartItem {
  productId: number;
  quantity: number;
  selectedOptions?: Record<string, string>;
  selectedPrice?: number;
  combinationId?: number;
}

export interface EcwidCart {
  id?: string;
  items: EcwidCartItem[];
  cartId?: string;
}

export interface EcwidAddCartLineResult {
  productId: string;
  variantId?: string;
  added: boolean;
  error?: string;
}

export interface EcwidAddCartLineInput {
  productId: string;
  quantity: number;
  variantId?: string;
  unitPrice?: number;
  options?: Record<string, string>;
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function ecwidFetch<T>(
  storeId: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${ECWID_API_BASE}/${storeId}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeader(token),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ecwid API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function productImageUrl(raw: Record<string, unknown>): string | undefined {
  const defaultImage = raw.defaultImage as Record<string, unknown> | undefined;
  const fromDefault = defaultImage?.url ?? defaultImage?.imageUrl ?? defaultImage?.thumbnailUrl;
  if (fromDefault) return String(fromDefault);

  const rootCandidates = [
    raw.imageUrl,
    raw.thumbnailUrl,
    raw.smallThumbnailUrl,
    raw.hdThumbnailUrl,
  ];
  for (const candidate of rootCandidates) {
    if (candidate) return String(candidate);
  }

  const imageCollections = [raw.mediaImages, raw.galleryImages];
  for (const collection of imageCollections) {
    if (!Array.isArray(collection) || collection.length === 0) continue;
    const img = collection[0] as Record<string, unknown>;
    const url = img.url ?? img.imageUrl ?? img.thumbnailUrl ?? img.smallThumbnailUrl;
    if (url) return String(url);
  }

  return undefined;
}

/**
 * Public storefront tokens only expose products that are enabled and visible in the
 * catalog, so reading a component through one turns a perfectly sellable bundle item
 * into a 404. Catalog reads back both the widget and server-side pricing, so they use
 * the private token whenever the app has one.
 */
function catalogApiToken(tokens: EcwidStoreTokens): string {
  return tokens.accessToken || tokens.publicToken || '';
}

function synthesizeVariantsFromOptions(
  price: number,
  inStock: boolean,
  catalogOptions: CatalogProduct['options'],
): CatalogVariant[] {
  const selectable = (catalogOptions ?? []).filter((o) => o.choices.length > 0);
  if (selectable.length === 0) return [];

  if (selectable.length === 1) {
    const opt = selectable[0];
    return opt.choices.map((choice) => ({
      id: choice,
      price,
      inStock,
      options: { [opt.name]: choice },
    }));
  }

  const variants: CatalogVariant[] = [];
  const build = (index: number, current: Record<string, string>) => {
    if (index >= selectable.length) {
      variants.push({
        id: Object.values(current).join(' / '),
        price,
        inStock,
        options: { ...current },
      });
      return;
    }
    const opt = selectable[index];
    for (const choice of opt.choices) {
      build(index + 1, { ...current, [opt.name]: choice });
    }
  };
  build(0, {});
  return variants;
}

function mapEcwidProduct(raw: Record<string, unknown>): CatalogProduct {
  const id = String(raw.id ?? '');
  const combinations = Array.isArray(raw.combinations) ? raw.combinations : [];
  const variants: CatalogVariant[] = combinations.map((c) => {
    const combo = c as Record<string, unknown>;
    const options: Record<string, string> = {};
    const opts = Array.isArray(combo.options) ? combo.options : [];
    for (const o of opts) {
      const opt = o as Record<string, unknown>;
      const name = String(opt.name ?? '');
      const value = String(opt.value ?? opt.text ?? '');
      if (name) options[name] = value;
    }
    return {
      id: String(combo.id ?? combo.combinationId ?? ''),
      sku: String(combo.sku ?? '') || undefined,
      price: Number(combo.price ?? raw.price ?? 0),
      compareToPrice: Number(combo.compareToPrice ?? raw.compareToPrice ?? 0) || undefined,
      inStock: combo.inStock !== false && Number(combo.quantity ?? raw.quantity ?? 1) !== 0,
      quantity: Number(combo.quantity ?? raw.quantity ?? 0) || undefined,
      options,
    };
  });

  const options = Array.isArray(raw.options)
    ? raw.options.map((o) => {
        const opt = o as Record<string, unknown>;
        const choicesRaw = Array.isArray(opt.choices) ? opt.choices : [];
        return {
          name: String(opt.name ?? ''),
          type: String(opt.type ?? 'SELECT'),
          choices: choicesRaw.map((c) => String((c as Record<string, unknown>).text ?? c)),
        };
      })
    : [];

  const resolvedVariants =
    variants.length > 0 ? variants : synthesizeVariantsFromOptions(Number(raw.price ?? 0), raw.inStock !== false, options);

  return {
    id,
    name: String(raw.name ?? ''),
    sku: String(raw.sku ?? '') || undefined,
    price: Number(raw.price ?? 0),
    compareToPrice: Number(raw.compareToPrice ?? 0) || undefined,
    imageUrl: productImageUrl(raw),
    inStock: raw.inStock !== false && Number(raw.quantity ?? 1) !== 0,
    quantity: Number(raw.quantity ?? 0) || undefined,
    variants: resolvedVariants.length > 0 ? resolvedVariants : undefined,
    options: options.length > 0 ? options : undefined,
  };
}

export function defaultProductOptions(product: CatalogProduct): Record<string, string> | undefined {
  if (product.variants?.length) {
    const variant = product.variants.find((v) => v.inStock) ?? product.variants[0];
    return variant.options;
  }
  if (product.options?.length) {
    const map: Record<string, string> = {};
    for (const opt of product.options) {
      if (opt.choices[0]) map[opt.name] = opt.choices[0];
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }
  return undefined;
}

export async function getProduct(
  tokens: EcwidStoreTokens,
  productId: string,
): Promise<CatalogProduct | null> {
  try {
    const raw = await ecwidFetch<Record<string, unknown>>(
      tokens.storeId,
      catalogApiToken(tokens),
      `/products/${productId}`,
    );
    return mapEcwidProduct(raw);
  } catch {
    return null;
  }
}

/** Enables Pay What You Want so storefront JS can pass selectedPrice when adding bundle lines. */
export async function ensureNameYourPriceEnabled(
  tokens: EcwidStoreTokens,
  productIds: string[],
): Promise<void> {
  if (!isPrivateStoreTokens(tokens) || productIds.length === 0) return;
  const unique = [...new Set(productIds.filter(Boolean))];
  await Promise.all(
    unique.map(async (productId) => {
      try {
        await ecwidFetch(tokens.storeId, tokens.accessToken, `/products/${productId}`, {
          method: 'PUT',
          body: JSON.stringify({ nameYourPriceEnabled: true }),
        });
      } catch (err) {
        console.warn('[pb] nameYourPriceEnabled failed', productId, err);
      }
    }),
  );
}

/** Ensures a hidden TEXT option exists so widget add-to-cart can stamp distinct deal lines. */
export async function ensureDealStampOption(
  tokens: EcwidStoreTokens,
  productIds: string[],
): Promise<void> {
  if (!isPrivateStoreTokens(tokens) || productIds.length === 0) return;

  const unique = [...new Set(productIds.filter(Boolean))];
  await Promise.all(
    unique.map(async (productId) => {
      try {
        const raw = await ecwidFetch<Record<string, unknown>>(
          tokens.storeId,
          tokens.accessToken,
          `/products/${productId}`,
        );
        const options = Array.isArray(raw.options) ? raw.options : [];
        if (options.some((row) => (row as Record<string, unknown>).name === PB_DEAL_TEXT_OPTION)) return;

        await ecwidFetch(tokens.storeId, tokens.accessToken, `/products/${productId}`, {
          method: 'PUT',
          body: JSON.stringify({
            options: [
              ...options,
              {
                type: 'TEXTFIELD',
                name: PB_DEAL_TEXT_OPTION,
                title: ' ',
                required: false,
              },
            ],
          }),
        });
      } catch (err) {
        console.warn('[pb] ensureDealStampOption failed', productId, err);
      }
    }),
  );
}

/** Remove legacy `_pbDeal` catalog options when migrating away from stamp-based lines. */
export async function removeDealStampOption(
  tokens: EcwidStoreTokens,
  productIds: string[],
): Promise<void> {
  if (!isPrivateStoreTokens(tokens) || productIds.length === 0) return;

  const unique = [...new Set(productIds.filter(Boolean))];
  await Promise.all(
    unique.map(async (productId) => {
      try {
        const raw = await ecwidFetch<Record<string, unknown>>(
          tokens.storeId,
          tokens.accessToken,
          `/products/${productId}`,
        );
        const options = Array.isArray(raw.options) ? raw.options : [];
        const filtered = options.filter(
          (row) => (row as Record<string, unknown>).name !== PB_DEAL_TEXT_OPTION,
        );
        if (filtered.length === options.length) return;

        await ecwidFetch(tokens.storeId, tokens.accessToken, `/products/${productId}`, {
          method: 'PUT',
          body: JSON.stringify({ options: filtered }),
        });
      } catch (err) {
        console.warn('[pb] removeDealStampOption failed', productId, err);
      }
    }),
  );
}

/**
 * Ecwid's REST API accepts a comma-separated `productId` filter that returns
 * many products in a single response. Fanning out to `GET /products/:id` per
 * ID (as we used to) turned a 5-item bundle add-to-cart into 5 sequential
 * ~250ms round-trips. The batch path resolves the same set of IDs in a single
 * hop and falls back to per-id fetches only when the batch response fails.
 *
 * Ecwid enforces a hard cap of 100 IDs per request, so long lists are chunked.
 */
const PRODUCT_BATCH_SIZE = 100;

async function fetchProductBatch(
  tokens: EcwidStoreTokens,
  batch: string[],
): Promise<CatalogProduct[]> {
  const params = new URLSearchParams({
    productId: batch.join(','),
    limit: String(batch.length),
  });
  try {
    const data = await ecwidFetch<{ items?: Record<string, unknown>[] }>(
      tokens.storeId,
      catalogApiToken(tokens),
      `/products?${params.toString()}`,
    );
    return (data.items ?? []).map(mapEcwidProduct);
  } catch (err) {
    console.warn('[pb] batch product fetch failed, falling back to per-id', err);
    const fallback = await Promise.all(batch.map((id) => getProduct(tokens, id)));
    return fallback.filter((p): p is CatalogProduct => p !== null);
  }
}

export async function getProducts(
  tokens: EcwidStoreTokens,
  productIds: string[],
): Promise<CatalogProduct[]> {
  const unique = [...new Set(productIds.filter(Boolean))];
  if (unique.length === 0) return [];
  if (unique.length === 1) {
    const one = await getProduct(tokens, unique[0]!);
    return one ? [one] : [];
  }

  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += PRODUCT_BATCH_SIZE) {
    batches.push(unique.slice(i, i + PRODUCT_BATCH_SIZE));
  }

  const batchResults = await Promise.all(batches.map((batch) => fetchProductBatch(tokens, batch)));
  const seen = new Set<string>();
  const merged: CatalogProduct[] = [];
  for (const batch of batchResults) {
    for (const product of batch) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      merged.push(product);
    }
  }
  return merged;
}

export async function searchProducts(
  tokens: EcwidStoreTokens,
  query: string,
  limit = 24,
): Promise<CatalogProduct[]> {
  const params = new URLSearchParams({
    keyword: query,
    limit: String(limit),
    enabled: 'true',
  });
  const data = await ecwidFetch<{ items?: Record<string, unknown>[] }>(
    tokens.storeId,
    catalogApiToken(tokens),
    `/products?${params.toString()}`,
  );
  return (data.items ?? []).map(mapEcwidProduct);
}

/**
 * Ecwid does not expose a stable REST endpoint for anonymous visitor carts on all plans.
 * When a cart snapshot is provided by the storefront JS, we use it directly.
 * When cartId looks like an Ecwid cart token, we attempt the legacy cart endpoint.
 */
export async function getCart(
  tokens: EcwidStoreTokens,
  cartId?: string,
  snapshot?: EcwidCart,
): Promise<EcwidCart> {
  if (snapshot?.items) return snapshot;
  if (!cartId) return { items: [] };

  try {
    const data = await ecwidFetch<{ cart?: EcwidCart }>(
      tokens.storeId,
      tokens.publicToken ?? tokens.accessToken,
      `/carts/${cartId}`,
    );
    return data.cart ?? { id: cartId, items: [], cartId };
  } catch {
    return { id: cartId, cartId, items: [] };
  }
}

export async function updateCartLine(
  tokens: EcwidStoreTokens,
  cartId: string,
  lineIndex: number,
  update: Partial<EcwidAddCartLineInput>,
): Promise<void> {
  await ecwidFetch(tokens.storeId, tokens.publicToken ?? tokens.accessToken, `/carts/${cartId}/items/${lineIndex}`, {
    method: 'PUT',
    body: JSON.stringify({
      quantity: update.quantity,
      selectedOptions: update.options,
      ...(update.unitPrice != null ? { selectedPrice: update.unitPrice } : {}),
    }),
  });
}

export async function removeCartLine(
  tokens: EcwidStoreTokens,
  cartId: string,
  lineIndex: number,
): Promise<void> {
  await ecwidFetch(tokens.storeId, tokens.publicToken ?? tokens.accessToken, `/carts/${cartId}/items/${lineIndex}`, {
    method: 'DELETE',
  });
}

export async function getStoreProfile(tokens: EcwidStoreTokens): Promise<Record<string, unknown>> {
  if (!isPrivateStoreTokens(tokens)) {
    throw new Error('Store profile requires a private access token');
  }
  return ecwidFetch(tokens.storeId, tokens.accessToken, '/profile');
}

export async function getOrder(
  tokens: EcwidStoreTokens,
  orderId: string,
): Promise<Record<string, unknown>> {
  return ecwidFetch(
    tokens.storeId,
    tokens.accessToken,
    `/orders/${encodeURIComponent(orderId)}`,
  );
}

export async function searchProductsByIds(
  tokens: EcwidStoreTokens,
  ids: string[],
): Promise<CatalogProduct[]> {
  return getProducts(tokens, ids);
}
