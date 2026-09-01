/**
 * Ecwid Instant Site injects URLs ending in /storefront.js into the page.
 * This loader fetches the full storefront bundle (pb-bundles.js).
 */
(function () {
  'use strict';
  if (window.__PB_BOOTSTRAP__) return;
  window.__PB_BOOTSTRAP__ = true;

  var self = document.currentScript;
  var src = (self && self.src) || '';
  var base = src.replace(/\/storefront\.js(?:\?.*)?$/i, '').replace(/\/$/, '');
  if (!base) {
    console.error('[pb-bundles] Unable to resolve app origin from storefront.js');
    return;
  }

  var el = document.createElement('script');
  el.src = base + '/storefront/pb-bundles.js?v=' + Date.now();
  el.async = true;
  var apiUrl = self && self.getAttribute('data-api-url');
  if (apiUrl) el.setAttribute('data-api-url', apiUrl);
  (document.head || document.documentElement).appendChild(el);
})();
