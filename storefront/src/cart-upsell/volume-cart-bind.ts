import { syncVolumeCart } from '../api';
import { cartIdFrom, cartLineSnapshots, getCart, refreshCart } from '../ecwid';
import { subscribeCartSync } from '../cart-sync-controller';

let unsubscribe: (() => void) | null = null;
let lastVolumeFingerprint = '';

async function runVolumeSync(): Promise<void> {
  try {
    const cart = await getCart();
    const lines = cartLineSnapshots(cart);
    if (!lines.length) {
      lastVolumeFingerprint = '';
      return;
    }

    const fp = lines.map((l) => `${l.productId}:${l.quantity}`).sort().join('|');
    if (fp === lastVolumeFingerprint) return;
    lastVolumeFingerprint = fp;

    const cartId = cartIdFrom(cart);
    const result = await syncVolumeCart(cartId, lines);
    if (result.updated && result.updated > 0) {
      await refreshCart();
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

/** Invalidate cached fingerprint so the next sync cycle triggers a fresh server call. */
export function invalidateVolumeCartFingerprint(): void {
  lastVolumeFingerprint = '';
}
