/// <reference types="vite/client" />

import { resolveApiBaseUrl, setApiBaseUrl } from './api';
import { runCartUpsell, teardownCartUpsell } from './cart-upsell/cart-upsell';
import { startVolumeCartSync, stopVolumeCartSync } from './cart-upsell/volume-cart-bind';
import { startBundleCartSync, stopBundleCartSync } from './bundle-cart-bind';
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
import { isInstantSiteHost } from './instant-site';
import type { EcwidPage } from './types';
import { injectStyles } from './utils';
import { apiBaseFromScript, findOwnScript } from './script-config';
import cartUpsellCss from './styles/cart-upsell.css?inline';
import widgetCss from './styles/widget.css?inline';

let initialized = false;

function enableCartSync(): void {
  startVolumeCartSync();
  startBundleCartSync();
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

  if (productPageLooksLikely(page)) {
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

  injectStyles('pb-widget-styles', widgetCss);
  injectStyles('pb-cart-upsell-styles', cartUpsellCss);
  readScriptConfig();
  resolveApiBaseUrl();

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
