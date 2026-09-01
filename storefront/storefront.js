/**
 * Ecwid Native apps inject /storefront.js automatically.
 */
(function () {
  "use strict";
  if (window.__PB_BOOTSTRAP__) return;
  window.__PB_BOOTSTRAP__ = true;
  window.__pbAppId = "custom-app-137010504-4";

  var self = document.currentScript;
  var src = (self && self.src) || "";
  var base = src.replace(/\/storefront\.js(?:\?.*)?$/i, "").replace(/\/$/, "");
  if (!base) {
    console.error("[pb-bundles] Unable to resolve app origin from storefront.js");
    return;
  }

  var el = document.createElement("script");
  el.src = base + "/storefront/pb-bundles.js?v=" + Date.now();
  el.async = true;
  el.setAttribute("data-api-base", (self && self.getAttribute("data-api-base")) || base);
  el.setAttribute("data-app-id", "custom-app-137010504-4");
  var storeId = self && self.getAttribute("data-store-id");
  if (storeId) el.setAttribute("data-store-id", storeId);
  (document.head || document.documentElement).appendChild(el);
})();
