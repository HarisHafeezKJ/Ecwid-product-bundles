import { syncVolumeCart } from '../api';
import { cartIdFrom, cartLineSnapshots, getCart, refreshCart } from '../ecwid';
import { CartSyncController } from '../cart-sync-controller';

let controller: CartSyncController | null = null;

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
  if (!controller) {
    controller = new CartSyncController({
      intervalMs: 12000,
      onSync: runVolumeSync,
    });
  }
  controller.start();
}

export function stopVolumeCartSync(): void {
  controller?.stop();
  controller = null;
}
