import { getCart, refreshCart } from './ecwid';
import { CartSyncController } from './cart-sync-controller';

let controller: CartSyncController | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function runBundleCartSync(): Promise<void> {
  try {
    const cart = await getCart();
    if (!cart?.items?.length) return;

    // Ecwid calls the app's discountUrl during calculateTotal — run twice so late
    // webhook responses are picked up after bundle lines finish adding.
    await refreshCart();
    await sleep(350);
    await refreshCart();
  } catch {
    /* silent */
  }
}

/** Ask Ecwid to recalculate cart totals (triggers discountUrl webhook for bundle deals). */
export function startBundleCartSync(): void {
  if (!controller) {
    controller = new CartSyncController({
      intervalMs: 10000,
      onSync: runBundleCartSync,
    });
  }
  controller.start();
}

export function stopBundleCartSync(): void {
  controller?.stop();
  controller = null;
}
