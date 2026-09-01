import { getCart, refreshCart } from './ecwid';
import { debounce } from './utils';

let started = false;

const debouncedSync = debounce(() => void runBundleCartSync(), 400);

/** Ask Ecwid to recalculate cart totals (triggers discountUrl webhook for bundle deals). */
export function startBundleCartSync(): void {
  if (started) return;
  started = true;

  document.addEventListener('pb-cart-changed', () => debouncedSync());
  window.addEventListener('pageshow', () => debouncedSync());

  window.setInterval(() => void runBundleCartSync(), 10000);
  void runBundleCartSync();
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
