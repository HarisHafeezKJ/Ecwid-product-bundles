import { getCart, refreshCart } from './ecwid';
import { subscribeCartSync } from './cart-sync-controller';

let unsubscribe: (() => void) | null = null;

async function runBundleCartSync(): Promise<void> {
  try {
    const cart = await getCart();
    // #region agent log
    console.warn('[pb-debug-7fcf40] runBundleCartSync', { itemCount: cart?.items?.length ?? 0, productIds: cart?.items?.map(i => i.product?.id ?? i.productId) ?? [], ts: Date.now() });
    // #endregion
    if (!cart?.items?.length) return;

    await refreshCart();
    // #region agent log
    console.warn('[pb-debug-7fcf40] runBundleCartSync refreshCart done', { ts: Date.now() });
    // #endregion
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
