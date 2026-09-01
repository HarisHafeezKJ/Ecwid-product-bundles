import type { EcwidApi, EcwidCart, EcwidPage, CartLineSnapshotPayload } from './types';
import {
  getInstantSite,
  instantSiteProductPage,
  isInstantSiteHost,
  productIdFromPageUrl,
  publicConfigFromInitialState,
  publicTokenFromInitialState,
  storeIdFromHostname,
} from './instant-site';
import { appRootFromScript, clientIdFromScript, clientIdSync, findOwnScript } from './script-config';
import { withTimeout } from './utils';

const CART_CALLBACK_TIMEOUT_MS = 8000;

let cachedClientId: string | undefined;

function storefrontConfigUrl(): string {
  const script = findOwnScript();
  const root = appRootFromScript(script);
  return `${root.replace(/\/$/, '')}/api/storefront/config`;
}

export function getEcwid(): EcwidApi | undefined {
  return window.Ecwid;
}

function runOnce(fn: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    try {
      fn();
    } catch (err) {
      console.warn('[pb-bundles] bootstrap failed', err);
    }
  };
}

function ecwidApiReady(): boolean {
  const ecwid = getEcwid();
  return typeof ecwid?.getOwnerId?.() === 'number' && ecwid.getOwnerId!() > 0;
}

export function whenEcwidReady(fn: () => void): void {
  const run = runOnce(fn);
  const ecwid = getEcwid();
  const instantSite = getInstantSite();

  if (ecwid?.OnAPILoaded) {
    ecwid.OnAPILoaded.add(run);
  }
  if (instantSite?.OnAPILoaded) {
    instantSite.OnAPILoaded.add(run);
  }

  if (ecwidApiReady()) {
    run();
  }

  const timer = window.setInterval(() => {
    if (ecwidApiReady()) {
      window.clearInterval(timer);
      run();
    }
  }, 150);
  window.setTimeout(() => window.clearInterval(timer), 20000);

  // Instant Site: still run on product URLs even if Ecwid API never becomes ready.
  if (isInstantSiteHost() && instantSiteProductPage()) {
    window.setTimeout(() => run(), 1500);
  }
}

export function onPageLoaded(fn: (page: EcwidPage) => void): void {
  const ecwid = getEcwid();
  if (ecwid?.OnPageLoaded) {
    ecwid.OnPageLoaded.add(fn);
  }
  const instantSite = getInstantSite();
  if (instantSite?.OnPageLoaded) {
    instantSite.OnPageLoaded.add((page) => fn(page as EcwidPage));
  }
}

export function getStoreId(): number | undefined {
  const ecwid = getEcwid();
  const fromApi = ecwid?.getOwnerId?.();
  if (typeof fromApi === 'number' && fromApi > 0) return fromApi;

  const fromHost = storeIdFromHostname();
  if (fromHost) return fromHost;

  const win = window as Window & { ecwid_store_id?: number; ecwid?: { storeId?: number } };
  if (typeof win.ecwid_store_id === 'number') return win.ecwid_store_id;
  if (typeof win.ecwid?.storeId === 'number') return win.ecwid.storeId;
  return undefined;
}

export function getPageType(page?: EcwidPage): string {
  const ecwid = getEcwid();
  const fromApi = ecwid?.getPageType?.();
  if (fromApi) return fromApi.toUpperCase();
  if (page?.type) return page.type.toUpperCase();
  if (instantSiteProductPage()) return 'PRODUCT';
  return '';
}

export function getProductId(page?: EcwidPage): number | undefined {
  const ecwid = getEcwid();
  const fromApi = ecwid?.getProductId?.();
  if (typeof fromApi === 'number' && fromApi > 0) return fromApi;
  if (typeof page?.productId === 'number' && page.productId > 0) return page.productId;
  return productIdFromPageUrl();
}

export function cartPageLooksLikely(page?: EcwidPage): boolean {
  if (getPageType(page) === 'CART') return true;
  return /\/cart(\/|$|-page)/i.test(window.location.pathname);
}

export function productPageLooksLikely(page?: EcwidPage): boolean {
  if (getPageType(page) === 'PRODUCT') return true;
  if (getProductId(page) != null) return true;
  return instantSiteProductPage();
}

export function getCart(): Promise<EcwidCart | null> {
  return withTimeout(
    new Promise((resolve) => {
      const cartApi = getEcwid()?.Cart;
      if (!cartApi?.get) {
        resolve(null);
        return;
      }
      cartApi.get((cart) => resolve(cart ?? null));
    }),
    CART_CALLBACK_TIMEOUT_MS,
    null,
  );
}

export function refreshCart(): Promise<void> {
  return withTimeout(
    new Promise((resolve) => {
      const cartApi = getEcwid()?.Cart;
      if (cartApi?.calculateTotal) {
        cartApi.calculateTotal(() => resolve());
        return;
      }
      resolve();
    }),
    CART_CALLBACK_TIMEOUT_MS,
    undefined,
  );
}

export function goToCheckout(): void {
  const ecwid = getEcwid();
  if (ecwid?.gotoCheckoutPage) {
    ecwid.gotoCheckoutPage();
    return;
  }
  ecwid?.openPage?.('checkout');
}

export function cartProductIds(cart: EcwidCart | null): string[] {
  if (!cart?.items?.length) return [];
  const ids = new Set<string>();
  for (const item of cart.items) {
    const id = item.product?.id ?? item.productId;
    if (id != null) ids.add(String(id));
  }
  return [...ids];
}

export function cartIdFrom(cart: EcwidCart | null): string | undefined {
  if (!cart) return undefined;
  return cart.cartId ?? cart.id ?? undefined;
}

export function cartLineSnapshots(cart: EcwidCart | null): CartLineSnapshotPayload[] {
  if (!cart?.items?.length) return [];

  return cart.items.map((item, index) => {
    const productId = item.product?.id ?? item.productId;
    const unitPrice = Number(item.price ?? item.productPrice ?? item.product?.price ?? 0);
    const catalogPrice = Number(
      item.productPrice ?? item.catalogPrice ?? item.price ?? item.product?.price ?? unitPrice,
    );
    const options = item.options ?? item.selectedOptions;

    return {
      lineId: item.id != null ? String(item.id) : String(index),
      productId: productId != null ? String(productId) : '',
      quantity: Math.max(0, Number(item.quantity ?? 0)),
      unitPrice,
      catalogPrice,
      ...(options && Object.keys(options).length > 0 ? { options } : {}),
    };
  }).filter((line) => line.productId && line.quantity > 0);
}

export function resolveClientIdSync(): string | undefined {
  return clientIdSync() ?? cachedClientId;
}

export async function resolveClientId(): Promise<string | undefined> {
  if (cachedClientId) return cachedClientId;

  const fromSync = clientIdSync();
  if (fromSync) {
    cachedClientId = fromSync;
    return cachedClientId;
  }

  const fromScript = clientIdFromScript(findOwnScript());
  if (fromScript) {
    cachedClientId = fromScript;
    return cachedClientId;
  }

  try {
    const res = await fetch(storefrontConfigUrl(), { credentials: 'include' });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { clientId?: string };
    cachedClientId = data.clientId?.trim() || undefined;
    return cachedClientId;
  } catch {
    return undefined;
  }
}

export function getEmbeddedPublicConfig(): Record<string, unknown> | null {
  const clientId = resolveClientIdSync();
  if (!clientId) return null;
  return publicConfigFromInitialState(clientId);
}

export async function getPublicToken(): Promise<string | undefined> {
  const clientId = resolveClientIdSync() ?? (await resolveClientId());
  if (!clientId) return undefined;

  const fromState = publicTokenFromInitialState(clientId);
  if (fromState) return fromState;

  const instantSite = getInstantSite();
  if (instantSite?.getAppPublicToken) {
    try {
      const token = instantSite.getAppPublicToken(clientId);
      if (typeof token === 'string' && token.trim()) return token.trim();
      if (token && typeof (token as Promise<string>).then === 'function') {
        const resolved = await token;
        if (resolved?.trim()) return resolved.trim();
      }
    } catch {
      /* fall through */
    }
  }

  const ecwid = getEcwid();
  if (!ecwid?.getAppPublicToken) return undefined;
  try {
    const token = ecwid.getAppPublicToken(clientId);
    if (typeof token === 'string' && token.trim()) return token.trim();
    if (token && typeof (token as Promise<string>).then === 'function') {
      const resolved = await token;
      return resolved?.trim() || undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
