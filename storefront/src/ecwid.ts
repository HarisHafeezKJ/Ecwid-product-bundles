import type { EcwidApi, EcwidCart, EcwidPage } from './types';
import {
  getInstantSite,
  instantSiteProductPage,
  isInstantSiteHost,
  productIdFromPageUrl,
  publicTokenFromInitialState,
  storeIdFromHostname,
} from './instant-site';

let cachedClientId: string | undefined;

function storefrontConfigUrl(): string {
  const script =
    document.currentScript ??
    [...document.querySelectorAll('script[src*="pb-bundles"]')].pop();
  if (script instanceof HTMLScriptElement && script.src) {
    try {
      return `${new URL(script.src).origin}/api/storefront/config`;
    } catch {
      /* fall through */
    }
  }
  return `${window.location.origin}/api/storefront/config`;
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
  return new Promise((resolve) => {
    const cartApi = getEcwid()?.Cart;
    if (!cartApi?.get) {
      resolve(null);
      return;
    }
    cartApi.get((cart) => resolve(cart ?? null));
  });
}

export function refreshCart(): Promise<void> {
  return new Promise((resolve) => {
    const cartApi = getEcwid()?.Cart;
    if (cartApi?.calculateTotal) {
      cartApi.calculateTotal(() => resolve());
      return;
    }
    resolve();
  });
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

export async function resolveClientId(): Promise<string | undefined> {
  if (cachedClientId) return cachedClientId;
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

export async function getPublicToken(): Promise<string | undefined> {
  const clientId = await resolveClientId();
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
