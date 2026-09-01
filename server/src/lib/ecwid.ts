import type { CatalogProduct, CatalogVariant } from '@pb/shared';

const ECWID_API_BASE = 'https://app.ecwid.com/api/v3';

export interface EcwidStoreTokens {
  storeId: string;
  accessToken: string;
  publicToken?: string;
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

function storefrontApiToken(tokens: EcwidStoreTokens): string {
  return tokens.publicToken ?? tokens.accessToken;
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
      storefrontApiToken(tokens),
      `/products/${productId}`,
    );
    return mapEcwidProduct(raw);
  } catch {
    return null;
  }
}

export async function getProducts(
  tokens: EcwidStoreTokens,
  productIds: string[],
): Promise<CatalogProduct[]> {
  const unique = [...new Set(productIds.filter(Boolean))];
  const results = await Promise.all(unique.map((id) => getProduct(tokens, id)));
  return results.filter((p): p is CatalogProduct => p !== null);
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
    storefrontApiToken(tokens),
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

/**
 * Adds lines to the cart with server-computed prices.
 *
 * Limitations (Ecwid):
 * - REST API cannot always set arbitrary sale prices on cart lines.
 * - Storefront JS supports selectedPrice only when nameYourPriceEnabled is true on the product.
 * - Recommended production approach: register discountUrl (customize_cart_calculation scope)
 *   and stamp pbOfferId/pbDealId in selected options so repricing survives qty changes.
 *
 * This helper returns the priced lines for the storefront to apply via Ecwid.Cart.addProduct,
 * and attempts a best-effort REST cart update when available.
 */
export async function addToCart(
  tokens: EcwidStoreTokens,
  cartId: string | undefined,
  lines: EcwidAddCartLineInput[],
): Promise<{ cartId?: string; lines: EcwidAddCartLineInput[]; addedCount: number }> {
  const pricedLines = lines.map((line) => ({
    ...line,
    options: {
      ...(line.options ?? {}),
    },
  }));

  if (!cartId) {
    return { cartId: undefined, lines: pricedLines, addedCount: 0 };
  }

  let addedCount = 0;
  for (const line of pricedLines) {
    const baseBody = {
      productId: Number(line.productId),
      quantity: line.quantity,
      ...(line.variantId ? { combinationId: Number(line.variantId) } : {}),
    };
    const attempts = [
      { ...baseBody, selectedOptions: line.options },
      {
        ...baseBody,
        selectedOptions: line.options,
        ...(line.unitPrice != null ? { selectedPrice: line.unitPrice } : {}),
      },
      baseBody,
    ];

    for (const body of attempts) {
      try {
        await ecwidFetch(
          tokens.storeId,
          storefrontApiToken(tokens),
          `/carts/${cartId}/items`,
          {
            method: 'POST',
            body: JSON.stringify(body),
          },
        );
        addedCount += 1;
        break;
      } catch {
        /* try next payload shape */
      }
    }
  }

  return { cartId, lines: pricedLines, addedCount };
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
  return ecwidFetch(tokens.storeId, tokens.accessToken, '/profile');
}

export async function searchProductsByIds(
  tokens: EcwidStoreTokens,
  ids: string[],
): Promise<CatalogProduct[]> {
  return getProducts(tokens, ids);
}
