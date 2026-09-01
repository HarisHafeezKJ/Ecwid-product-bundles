import { cartPageLooksLikely } from '../ecwid';
import type { EcwidPage } from '../types';

export const UPSELL_MOUNT_ID = 'pb-cart-upsell';
const CONFIG_ID = 'pb-upsell-config';

export function isCartUpsellEnabled(): boolean {
  const cfg = document.getElementById(CONFIG_ID);
  if (!cfg) return true;
  return cfg.getAttribute('data-enabled') !== 'false';
}

export function ensureCartUpsellMount(page?: EcwidPage): HTMLElement | null {
  if (!cartPageLooksLikely(page)) return null;
  if (!isCartUpsellEnabled()) return null;

  let mount = document.getElementById(UPSELL_MOUNT_ID);
  if (mount) return mount;

  mount = document.createElement('div');
  mount.id = UPSELL_MOUNT_ID;

  const anchor =
    document.querySelector('.ec-cart') ??
    document.querySelector('.ecwid-cart') ??
    document.querySelector('[data-hook="cart-page"]') ??
    document.querySelector('.cart-page') ??
    document.querySelector('.ec-cart__products');

  if (anchor instanceof HTMLElement) {
    const coupon =
      anchor.querySelector('.ec-cart__coupon') ??
      anchor.querySelector('.cart-coupon') ??
      anchor.querySelector('[data-hook="cart-coupon"]');
    if (coupon?.parentElement) {
      coupon.parentElement.insertBefore(mount, coupon);
    } else {
      anchor.appendChild(mount);
    }
  } else {
    document.body.appendChild(mount);
  }

  return mount;
}

export function removeCartUpsellMount(): void {
  document.getElementById(UPSELL_MOUNT_ID)?.remove();
}

export function interceptNativeCheckout(onCheckout: () => void): () => void {
  const selector =
    '.ec-cart__checkout, .ecwid-checkout, [data-hook="checkout-button"], a[href*="checkout"]';
  const handler = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest(selector);
    if (!btn) return;
    if (btn.getAttribute('data-pb-bypass') === 'true') return;
    event.preventDefault();
    event.stopPropagation();
    onCheckout();
  };

  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
}

export function clickNativeCheckout(): void {
  const btn = document.querySelector<HTMLElement>(
    '.ec-cart__checkout, .ecwid-checkout, [data-hook="checkout-button"], a[href*="checkout"]',
  );
  if (btn) {
    btn.setAttribute('data-pb-bypass', 'true');
    btn.click();
  }
}
