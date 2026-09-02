import { debounce } from './utils';

const QTY_SELECTOR =
  'input[type="number"], .ec-cart__qty input, .ecwid-productBrowser-cart-qty, [data-hook="cart-item-qty"]';

const CART_ROOT_SELECTOR = '.ec-cart, .ecwid-cart, [data-hook="cart-page"], .cart-page';

const CART_ROOT_POLL_MS = 500;
const CART_ROOT_POLL_TIMEOUT_MS = 8_000;

export type CartSyncFn = () => void | Promise<void>;

interface Subscriber {
  fn: CartSyncFn;
  intervalMs: number;
  intervalId: number | null;
  running: boolean;
}

/**
 * Shared cart-change listener used by every "watch the cart, keep our data in
 * sync" feature (volume repricing, bundle discount refresh, etc). Every
 * subscriber adds cost: DOM observers and timers only exist while at least one
 * subscriber is registered, and the mutation observer is scoped to the cart
 * container rather than `document.body` so unrelated storefront animations do
 * not cause thousands of wasted syncs per minute.
 */
class SharedCartSync {
  private started = false;
  private observer: MutationObserver | null = null;
  private observedRoot: Element | null = null;
  private rootPollId: number | null = null;
  private readonly subscribers = new Set<Subscriber>();
  private readonly debouncedNotify: () => void;

  constructor() {
    this.debouncedNotify = debounce(() => {
      if (!this.started) return;
      this.runAll();
    }, 400);
  }

  subscribe(fn: CartSyncFn, intervalMs = 12_000): () => void {
    const sub: Subscriber = { fn, intervalMs, intervalId: null, running: false };
    this.subscribers.add(sub);
    this.ensureStarted();
    this.armInterval(sub);
    void this.runSubscriber(sub);
    return () => this.unsubscribe(sub);
  }

  /** Removes every subscriber and tears down listeners. */
  reset(): void {
    for (const sub of [...this.subscribers]) this.unsubscribe(sub);
  }

  private unsubscribe(sub: Subscriber): void {
    if (!this.subscribers.delete(sub)) return;
    if (sub.intervalId != null) {
      window.clearInterval(sub.intervalId);
      sub.intervalId = null;
    }
    if (this.subscribers.size === 0) this.teardown();
  }

  private armInterval(sub: Subscriber): void {
    if (sub.intervalId != null || sub.intervalMs <= 0) return;
    sub.intervalId = window.setInterval(() => void this.runSubscriber(sub), sub.intervalMs);
  }

  private async runSubscriber(sub: Subscriber): Promise<void> {
    if (sub.running) return;
    sub.running = true;
    try {
      await sub.fn();
    } catch (err) {
      console.warn('[pb-bundles] cart sync subscriber failed', err);
    } finally {
      sub.running = false;
    }
  }

  private runAll(): void {
    for (const sub of this.subscribers) void this.runSubscriber(sub);
  }

  private ensureStarted(): void {
    if (this.started) return;
    this.started = true;

    document.addEventListener('change', this.onQtyChange, true);
    document.addEventListener('input', this.onQtyChange, true);
    document.addEventListener('focusin', this.debouncedNotify);
    document.addEventListener('pb-cart-changed', this.debouncedNotify);
    window.addEventListener('pageshow', this.debouncedNotify);

    this.attachObserver();
  }

  private teardown(): void {
    this.started = false;
    document.removeEventListener('change', this.onQtyChange, true);
    document.removeEventListener('input', this.onQtyChange, true);
    document.removeEventListener('focusin', this.debouncedNotify);
    document.removeEventListener('pb-cart-changed', this.debouncedNotify);
    window.removeEventListener('pageshow', this.debouncedNotify);
    this.observer?.disconnect();
    this.observer = null;
    this.observedRoot = null;
    if (this.rootPollId != null) {
      window.clearInterval(this.rootPollId);
      this.rootPollId = null;
    }
  }

  /**
   * Cart containers can render late on Instant Site — poll briefly until one
   * appears, then attach the observer to that node. Falls back to observing
   * `document.body` only when the poll times out.
   */
  private attachObserver(): void {
    const root = document.querySelector(CART_ROOT_SELECTOR);
    if (root) {
      this.attachTo(root);
      return;
    }

    const deadline = Date.now() + CART_ROOT_POLL_TIMEOUT_MS;
    this.rootPollId = window.setInterval(() => {
      if (!this.started) return;
      const next = document.querySelector(CART_ROOT_SELECTOR);
      if (next) {
        if (this.rootPollId != null) window.clearInterval(this.rootPollId);
        this.rootPollId = null;
        this.attachTo(next);
      } else if (Date.now() >= deadline) {
        if (this.rootPollId != null) window.clearInterval(this.rootPollId);
        this.rootPollId = null;
        this.attachTo(document.body);
      }
    }, CART_ROOT_POLL_MS);
  }

  private attachTo(root: Element): void {
    if (this.observedRoot === root && this.observer) return;
    this.observer?.disconnect();
    this.observedRoot = root;
    this.observer = new MutationObserver(() => this.debouncedNotify());
    this.observer.observe(root, { childList: true, subtree: true });
  }

  private readonly onQtyChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches(QTY_SELECTOR)) this.debouncedNotify();
  };
}

const sharedCartSync = new SharedCartSync();

export interface CartSyncSubscriptionOptions {
  intervalMs?: number;
}

/** Register a callback to run on cart changes; returns an unsubscribe function. */
export function subscribeCartSync(
  fn: CartSyncFn,
  options: CartSyncSubscriptionOptions = {},
): () => void {
  return sharedCartSync.subscribe(fn, options.intervalMs ?? 12_000);
}

/** Test-only helper: unregister every subscriber and stop DOM listeners. */
export function resetCartSync(): void {
  sharedCartSync.reset();
}
