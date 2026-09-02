import { getCart, refreshCart } from './ecwid';
import { subscribeCartSync } from './cart-sync-controller';

let unsubscribe: (() => void) | null = null;

async function runBundleCartSync(): Promise<void> {
  try {
    const cart = await getCart();
    if (!cart?.items?.length) return;

    // A single `calculateTotal` triggers our `discountUrl` webhook, which is the
    // supported way to attach the bundle discount to the cart. The previous
    // implementation refreshed twice with a 350ms sleep between them, which
    // doubled the load on Ecwid without any observed benefit — the second call
    // returned the same result as the first once the webhook responded.
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
