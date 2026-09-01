/// <reference types="vite/client" />

import { resolveApiBaseUrl, setApiBaseUrl } from './api';
import { runCartUpsell, teardownCartUpsell } from './cart-upsell/cart-upsell';
import { startVolumeCartSync } from './cart-upsell/volume-cart-bind';
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
import type { EcwidPage } from './types';
import { injectStyles } from './utils';
import cartUpsellCss from './styles/cart-upsell.css?inline';
import widgetCss from './styles/widget.css?inline';

let initialized = false;

function readScriptConfig(): void {
  const script =
    document.currentScript ??
    [...document.querySelectorAll('script[src*="pb-bundles"]')].pop();
  if (!(script instanceof HTMLScriptElement)) return;
  const apiUrl = script.getAttribute('data-api-url');
  if (apiUrl) setApiBaseUrl(apiUrl);
}

function handlePage(page?: EcwidPage): void {
  const pageType = getPageType(page);

  if (productPageLooksLikely(page)) {
    teardownCartUpsell();
    void initProductWidgets(page);
    return;
  }

  teardownProductWidgets();

  if (cartPageLooksLikely(page) || pageType === 'CART') {
    void runCartUpsell(page);
    return;
  }

  teardownCartUpsell();
}

function bootstrap(): void {
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
    startVolumeCartSync();

    onPageLoaded((page) => handlePage(page));

    const ecwid = window.Ecwid;
    ecwid?.OnPageLoad?.add(() => {
      /* early hook for future skeleton UI */
    });

    handlePage();
  });
}

export function init(): void {
  bootstrap();
}

bootstrap();

console.info('[pb-bundles] script loaded', window.location.href);

window.PbBundles = { init };

export { resolveApiBaseUrl, setApiBaseUrl };
