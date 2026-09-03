/// <reference types="vite/client" />

import { resolveApiBaseUrl, setApiBaseUrl } from './api';
import { runCartUpsell, teardownCartUpsell } from './cart-upsell/cart-upsell';
import { startVolumeCartSync, stopVolumeCartSync } from './cart-upsell/volume-cart-bind';
import { startBundleCartSync, stopBundleCartSync, invalidateBundleCartFingerprint } from './bundle-cart-bind';
import { suppressCartSyncForRemove } from './cart-sync-controller';
import { invalidateVolumeCartFingerprint } from './cart-upsell/volume-cart-bind';
import {
  cartPageLooksLikely,
  getPageType,
  getProductId,
  getStoreId,
  onPageLoaded,
  productPageLooksLikely,
  whenEcwidReady,
} from './ecwid';
import { initProductWidgets, teardownProductWidgets } from './product-widget';
import { startDealStampUiGuard } from './deal-stamp-ui';
import { correctCartBadge } from './cart-badge-fix';
import { setCartBadgeFix } from './ecwid';
import { isInstantSiteHost } from './instant-site';
import type { EcwidPage } from './types';
import { injectStyles } from './utils';
import { apiBaseFromScript, findOwnScript } from './script-config';
import cartUpsellCss from './styles/cart-upsell.css?inline';

let initialized = false;
let stopDealStampUi: (() => void) | undefined;
let removeSuppressBound = false;
let lastHandledPageType = '';

const ECWID_REMOVE_SELECTORS =
  '.ec-cart-item__control-inner, .ec-cart-item__control, .ec-cart-item__delete, .ec-cart-remove-button, [data-hook="cart-item-remove"], .ecwid-cart-remove, [aria-label="Remove Item"]';

function bindRemoveSuppression(): void {
  if (removeSuppressBound) return;
  removeSuppressBound = true;
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(ECWID_REMOVE_SELECTORS)) {
      suppressCartSyncForRemove();
      invalidateBundleCartFingerprint();
      invalidateVolumeCartFingerprint();
    }
  }, true);
}

function enableCartSync(): void {
  startVolumeCartSync();
  startBundleCartSync();
  bindRemoveSuppression();
}

function disableCartSync(): void {
  stopVolumeCartSync();
  stopBundleCartSync();
}

function readScriptConfig(): void {
  const script = findOwnScript();
  if (!script) return;
  setApiBaseUrl(apiBaseFromScript(script));
}

function handlePage(page?: EcwidPage): void {
  const pageType = getPageType(page);
  const isCart = cartPageLooksLikely(page) || pageType === 'CART';
  const key = isCart ? 'CART' : productPageLooksLikely(page) ? 'PRODUCT' : pageType || 'OTHER';

  if (key === lastHandledPageType && key !== 'PRODUCT') return;
  lastHandledPageType = key;

  if (key === 'PRODUCT') {
    teardownCartUpsell();
    disableCartSync();
    void initProductWidgets(page);
    return;
  }

  teardownProductWidgets();

  if (isCart) {
    enableCartSync();
    void runCartUpsell(page);
    return;
  }

  teardownCartUpsell();
  disableCartSync();
}

function bootstrap(): void {
  const win = window as Window & { __PB_LOADED__?: boolean };
  if (win.__PB_LOADED__) return;
  win.__PB_LOADED__ = true;

  if (initialized) return;
  initialized = true;

  injectStyles('pb-cart-upsell-styles', cartUpsellCss);
  readScriptConfig();
  resolveApiBaseUrl();
  setCartBadgeFix(() => void correctCartBadge());
  stopDealStampUi?.();
  stopDealStampUi = startDealStampUiGuard();

  whenEcwidReady(() => {
    console.info('[pb-bundles] storefront ready', {
      storeId: getStoreId(),
      page: getPageType(),
      productId: getProductId(),
    });

    // Cart sync used to start eagerly here, which meant the mutation observer
    // and 10–12s interval ran on every page (product, category, home, …) even
    // though it only has work to do on the cart page. It is now started from
    // inside `handlePage` when the shopper actually lands on the cart.

    onPageLoaded((page) => handlePage(page));

    const ecwid = window.Ecwid;
    ecwid?.OnPageLoad?.add(() => {
      /* early hook for future skeleton UI */
    });

    // Instant Site hydrates product DOM after our script runs; defer initial mount.
    if (isInstantSiteHost()) {
      window.setTimeout(() => handlePage(), 500);
      window.setTimeout(() => handlePage(), 2000);
    } else {
      handlePage();
    }
  });
}

export function init(): void {
  bootstrap();
}

bootstrap();

console.info('[pb-bundles] script loaded', window.location.href);

window.PbBundles = { init };

export { resolveApiBaseUrl, setApiBaseUrl };
