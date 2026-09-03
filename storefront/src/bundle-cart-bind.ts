import { getCart, refreshCart } from './ecwid';
import { subscribeCartSync } from './cart-sync-controller';

let unsubscribe: (() => void) | null = null;
let hadCartItems = false;

async function runBundleCartSync(): Promise<void> {
  try {
    const cart = await getCart();
    const hasItems = !!cart?.items?.length;
    // #region agent log
    console.warn('[pb-debug-7fcf40] runBundleCartSync', { hasItems, hadCartItems, itemCount: cart?.items?.length ?? 0, ts: Date.now() });
    // #endregion

    if (!hasItems) {
      if (hadCartItems) {
        hadCartItems = false;
        // #region agent log
        console.warn('[pb-debug-7fcf40] cart emptied → final refreshCart for badge', { ts: Date.now() });
        // #endregion
        await refreshCart();
      }
      return;
    }
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
