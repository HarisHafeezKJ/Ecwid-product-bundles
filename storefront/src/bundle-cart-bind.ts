import { getCart, refreshCart } from './ecwid';
import { subscribeCartSync } from './cart-sync-controller';

let unsubscribe: (() => void) | null = null;
let hadCartItems = false;
let lastCartFingerprint = '';

function cartFingerprint(cart: { items?: { productId?: number; product?: { id?: number }; quantity?: number; options?: Record<string, string>; selectedOptions?: Record<string, string> }[] } | null): string {
  if (!cart?.items?.length) return '';
  return cart.items
    .map((item) => {
      const id = item.product?.id ?? item.productId ?? 0;
      const opts = item.options ?? item.selectedOptions ?? {};
      return `${id}:${item.quantity ?? 0}:${Object.entries(opts).sort().map(([k, v]) => `${k}=${v}`).join('&')}`;
    })
    .sort()
    .join('|');
}

async function runBundleCartSync(): Promise<void> {
  try {
    const cart = await getCart();
    const hasItems = !!cart?.items?.length;

    if (!hasItems) {
      if (hadCartItems) {
        hadCartItems = false;
        lastCartFingerprint = '';
        await refreshCart();
      }
      return;
    }

    const fp = cartFingerprint(cart);
    if (fp === lastCartFingerprint) return;
    lastCartFingerprint = fp;

    hadCartItems = true;
    await refreshCart();
  } catch {
    /* silent */
  }
}

/** Ask Ecwid to recalculate cart totals (triggers discountUrl webhook for bundle deals). */
export function startBundleCartSync(): void {
  if (unsubscribe) return;
  unsubscribe = subscribeCartSync(runBundleCartSync, { intervalMs: 15_000 });
}

export function stopBundleCartSync(): void {
  unsubscribe?.();
  unsubscribe = null;
}

/** Invalidate cached fingerprint so the next sync cycle triggers a fresh calculateTotal. */
export function invalidateBundleCartFingerprint(): void {
  lastCartFingerprint = '';
}
