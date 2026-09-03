import { getCart } from './ecwid';

const BADGE_SELECTORS = [
  '.ec-minicart__counter',
  '.ec-minicart__count',
  '.ec-cart-widget__count',
  '.ec-minicart-count',
  '.shopping-cart__count',
  '.ec-header-cart__count',
  '[data-count]',
].join(', ');

function totalCartQty(items: { quantity?: number }[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)), 0);
}

function patchBadgeElements(total: number): void {
  const badges = document.querySelectorAll<HTMLElement>(BADGE_SELECTORS);
  for (const badge of badges) {
    const text = badge.textContent?.trim() ?? '';
    const displayed = parseInt(text, 10);
    if (!isNaN(displayed) && displayed !== total) {
      badge.textContent = String(total);
    }
    if (badge.hasAttribute('data-count')) {
      const attr = parseInt(badge.getAttribute('data-count') ?? '', 10);
      if (!isNaN(attr) && attr !== total) {
        badge.setAttribute('data-count', String(total));
      }
    }
  }

  // Instant Site header badge — find any small numeric span/badge near a cart link
  const cartLinks = document.querySelectorAll<HTMLElement>(
    'a[href*="/cart"], a[href*="#!/~/cart"], [class*="cart"] [class*="count"], [class*="cart"] [class*="badge"]',
  );
  for (const el of cartLinks) {
    const candidate = el.querySelector<HTMLElement>('span, .badge, [class*="count"]') ?? el;
    const text = candidate.textContent?.trim() ?? '';
    const displayed = parseInt(text, 10);
    if (!isNaN(displayed) && displayed > 0 && displayed !== total && text.length <= 4) {
      candidate.textContent = String(total);
    }
  }
}

let pending = false;

/**
 * Read the real Ecwid cart and fix minicart badges that show
 * line-item count instead of total quantity.
 */
export async function correctCartBadge(): Promise<void> {
  if (pending) return;
  pending = true;
  try {
    const cart = await getCart();
    const items = cart?.items ?? [];
    const total = totalCartQty(items);
    patchBadgeElements(total);
  } catch {
    /* silent */
  } finally {
    pending = false;
  }
}
