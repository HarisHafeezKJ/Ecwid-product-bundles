import { syncVolumeCart } from '../api';
import { cartIdFrom, cartLineSnapshots, getCart, refreshCart } from '../ecwid';
import { subscribeCartSync } from '../cart-sync-controller';

let unsubscribe: (() => void) | null = null;

async function runVolumeSync(): Promise<void> {
  try {
    const cart = await getCart();
    const lines = cartLineSnapshots(cart);
    if (!lines.length) return;

    const cartId = cartIdFrom(cart);
    const result = await syncVolumeCart(cartId, lines);
    if (result.updated && result.updated > 0) {
      await refreshCart();
      document.dispatchEvent(new CustomEvent('pb-cart-changed'));
    }
  } catch {
    /* silent — server may not be ready yet */
  }
}

export function startVolumeCartSync(): void {
  if (unsubscribe) return;
  unsubscribe = subscribeCartSync(runVolumeSync, { intervalMs: 12_000 });
}

export function stopVolumeCartSync(): void {
  unsubscribe?.();
  unsubscribe = null;
}
