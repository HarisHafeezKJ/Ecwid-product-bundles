import { debounce } from './utils';

const QTY_SELECTOR =
  'input[type="number"], .ec-cart__qty input, .ecwid-productBrowser-cart-qty, [data-hook="cart-item-qty"]';

export interface CartSyncControllerOptions {
  intervalMs: number;
  onSync: () => void | Promise<void>;
}

/** Shared cart-change listeners for bundle discount refresh and volume price sync. */
export class CartSyncController {
  private started = false;
  private observer: MutationObserver | null = null;
  private intervalId: number | null = null;
  private readonly debouncedSync: () => void;

  constructor(private readonly options: CartSyncControllerOptions) {
    // A debounce scheduled just before stop() would otherwise still fire after teardown.
    this.debouncedSync = debounce(() => {
      if (!this.started) return;
      void options.onSync();
    }, 400);
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    document.addEventListener('change', this.onQtyChange, true);
    document.addEventListener('input', this.onQtyChange, true);
    document.addEventListener('focusin', this.debouncedSync);
    document.addEventListener('pb-cart-changed', this.debouncedSync);
    window.addEventListener('pageshow', this.debouncedSync);

    this.observer = new MutationObserver(() => this.debouncedSync());
    this.observer.observe(document.body, { childList: true, subtree: true });

    this.intervalId = window.setInterval(() => void this.options.onSync(), this.options.intervalMs);
    void this.options.onSync();
  }

  stop(): void {
    this.started = false;
    document.removeEventListener('change', this.onQtyChange, true);
    document.removeEventListener('input', this.onQtyChange, true);
    document.removeEventListener('focusin', this.debouncedSync);
    document.removeEventListener('pb-cart-changed', this.debouncedSync);
    window.removeEventListener('pageshow', this.debouncedSync);
    this.observer?.disconnect();
    this.observer = null;
    if (this.intervalId != null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private readonly onQtyChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches(QTY_SELECTOR)) this.debouncedSync();
  };
}
