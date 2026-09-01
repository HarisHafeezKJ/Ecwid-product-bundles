import type { EcwidApi, EcwidCart, EcwidPage } from './types';

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

export function whenEcwidReady(fn: () => void): void {
  const ecwid = getEcwid();
  if (ecwid?.OnAPILoaded) {
    ecwid.OnAPILoaded.add(fn);
    return;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => whenEcwidReady(fn));
    return;
  }
  const timer = window.setInterval(() => {
    if (getEcwid()?.OnAPILoaded) {
      window.clearInterval(timer);
      whenEcwidReady(fn);
    }
  }, 50);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}

export function onPageLoaded(fn: (page: EcwidPage) => void): void {
  const ecwid = getEcwid();
  if (ecwid?.OnPageLoaded) {
    ecwid.OnPageLoaded.add(fn);
  }
}

export function getStoreId(): number | undefined {
  const ecwid = getEcwid();
  const fromApi = ecwid?.getOwnerId?.();
  if (typeof fromApi === 'number' && fromApi > 0) return fromApi;
  const win = window as Window & { ecwid_store_id?: number; ecwid?: { storeId?: number } };
  if (typeof win.ecwid_store_id === 'number') return win.ecwid_store_id;
  if (typeof win.ecwid?.storeId === 'number') return win.ecwid.storeId;
  return undefined;
}

export function getPageType(page?: EcwidPage): string {
  const ecwid = getEcwid();
  const fromApi = ecwid?.getPageType?.();
  if (fromApi) return fromApi.toUpperCase();
  return (page?.type ?? '').toUpperCase();
}

export function getProductId(page?: EcwidPage): number | undefined {
  const ecwid = getEcwid();
  const fromApi = ecwid?.getProductId?.();
  if (typeof fromApi === 'number' && fromApi > 0) return fromApi;
  if (typeof page?.productId === 'number' && page.productId > 0) return page.productId;
  return undefined;
}

export function cartPageLooksLikely(page?: EcwidPage): boolean {
  if (getPageType(page) === 'CART') return true;
  return /\/cart(\/|$|-page)/i.test(window.location.pathname);
}

export function productPageLooksLikely(page?: EcwidPage): boolean {
  if (getPageType(page) === 'PRODUCT') return true;
  return getProductId(page) != null;
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
  const ecwid = getEcwid();
  const clientId = await resolveClientId();
  if (!ecwid?.getAppPublicToken || !clientId) return undefined;
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
