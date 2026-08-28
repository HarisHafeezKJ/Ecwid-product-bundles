import { syncVolumeCart } from '../api';
import { cartIdFrom, getCart, refreshCart } from '../ecwid';
import { debounce } from '../utils';

let started = false;
let observer: MutationObserver | null = null;

const debouncedSync = debounce(() => void runVolumeSync(), 400);

export function startVolumeCartSync(): void {
  if (started) return;
  started = true;

  document.addEventListener('change', onQtyChange, true);
  document.addEventListener('input', onQtyChange, true);
  document.addEventListener('focusin', () => debouncedSync());
  document.addEventListener('pb-cart-changed', () => debouncedSync());
  window.addEventListener('pageshow', () => debouncedSync());

  observer = new MutationObserver(() => debouncedSync());
  observer.observe(document.body, { childList: true, subtree: true });

  window.setInterval(() => void runVolumeSync(), 12000);
  void runVolumeSync();
}

async function runVolumeSync(): Promise<void> {
  try {
    const cart = await getCart();
    const cartId = cartIdFrom(cart);
    const result = await syncVolumeCart(cartId);
    if (result.updated && result.updated > 0) {
      await refreshCart();
      document.dispatchEvent(new CustomEvent('pb-cart-changed'));
    }
  } catch {
    /* silent — server may not be ready yet */
  }
}

function onQtyChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (
    target.matches(
      'input[type="number"], .ec-cart__qty input, .ecwid-productBrowser-cart-qty, [data-hook="cart-item-qty"]',
    )
  ) {
    debouncedSync();
  }
}

export function stopVolumeCartSync(): void {
  started = false;
  observer?.disconnect();
  observer = null;
}
